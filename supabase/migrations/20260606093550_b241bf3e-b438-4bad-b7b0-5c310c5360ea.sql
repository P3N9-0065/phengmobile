CREATE OR REPLACE FUNCTION public.return_sale_items(_sale_id uuid, _items jsonb, _reason text DEFAULT NULL::text, _restock boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _sale public.sales%ROWTYPE;
  _return_id uuid;
  _code text;
  _refund_total numeric := 0;
  _returned_qty int;
  _item record;
  _si record;
  _cat item_category;
  _earn_reversal int := 0;
  _redeem_restore int := 0;
  _orig_subtotal numeric;
  _ratio numeric;
BEGIN
  IF NOT has_role(_uid,'admin') THEN RAISE EXCEPTION 'permission denied'; END IF;

  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN
    RAISE EXCEPTION 'ຕ້ອງລະບຸເຫດຜົນການຄືນ';
  END IF;

  SELECT * INTO _sale FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF _sale.id IS NULL THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF _sale.status = 'voided' THEN RAISE EXCEPTION 'sale already voided'; END IF;

  -- Time limit: 7 days from sale creation
  IF _sale.created_at < (now() - interval '7 days') THEN
    RAISE EXCEPTION 'ບໍ່ສາມາດຄືນໄດ້: ເກີນ 7 ວັນນັບຈາກວັນຂາຍ';
  END IF;

  -- Reject when points were used or discount applied
  IF COALESCE(_sale.points_redeemed,0) > 0 THEN
    RAISE EXCEPTION 'ບໍ່ສາມາດຄືນໄດ້: ບິນນີ້ໃຊ້ແຕ້ມສະສົມ';
  END IF;
  IF COALESCE(_sale.discount,0) > 0 THEN
    RAISE EXCEPTION 'ບໍ່ສາມາດຄືນໄດ້: ບິນນີ້ມີສ່ວນຫຼຸດ';
  END IF;

  _code := gen_return_code();
  INSERT INTO public.sale_returns(sale_id,return_code,kind,reason,restock,created_by)
    VALUES (_sale_id,_code,'partial',_reason,_restock,_uid)
    RETURNING id INTO _return_id;

  FOR _item IN SELECT (e->>'sale_item_id')::uuid AS sale_item_id, (e->>'qty')::int AS qty
               FROM jsonb_array_elements(_items) e
  LOOP
    IF _item.qty IS NULL OR _item.qty <= 0 THEN CONTINUE; END IF;
    SELECT si.* INTO _si FROM public.sale_items si WHERE si.id=_item.sale_item_id AND si.sale_id=_sale_id;
    IF _si.id IS NULL THEN RAISE EXCEPTION 'sale item not in sale'; END IF;

    -- Reject phone categories
    IF _si.item_id IS NOT NULL THEN
      SELECT category INTO _cat FROM public.inventory_items WHERE id=_si.item_id;
      IF _cat IN ('phone_new','phone_used') THEN
        RAISE EXCEPTION 'ບໍ່ສາມາດຄືນສິນຄ້າມືຖື: %', _si.name_snapshot;
      END IF;
    END IF;

    SELECT COALESCE(SUM(qty),0) INTO _returned_qty
      FROM public.sale_return_items sri
      JOIN public.sale_returns sr ON sr.id=sri.return_id
      WHERE sri.sale_item_id=_si.id AND sr.id <> _return_id;

    IF _item.qty > (_si.qty - _returned_qty) THEN
      RAISE EXCEPTION 'qty exceeds remaining for %', _si.name_snapshot;
    END IF;

    INSERT INTO public.sale_return_items(return_id,sale_item_id,item_id,qty,unit_price,line_total)
      VALUES (_return_id,_si.id,_si.item_id,_item.qty,_si.unit_price,_si.unit_price*_item.qty);

    _refund_total := _refund_total + (_si.unit_price * _item.qty);

    IF _restock AND _si.item_id IS NOT NULL THEN
      INSERT INTO public.stock_movements(item_id,qty,type,note,created_by)
      VALUES (_si.item_id,_item.qty,'return','RT '||_code,_uid);
    END IF;
  END LOOP;

  IF _refund_total <= 0 THEN
    DELETE FROM public.sale_returns WHERE id=_return_id;
    RAISE EXCEPTION 'nothing returned';
  END IF;

  UPDATE public.sale_returns SET refund_amount=_refund_total WHERE id=_return_id;

  IF _sale.customer_id IS NOT NULL THEN
    _orig_subtotal := NULLIF(_sale.subtotal,0);
    IF _orig_subtotal IS NOT NULL THEN
      _ratio := LEAST(1, _refund_total / _orig_subtotal);
      _earn_reversal  := FLOOR(COALESCE(_sale.points_earned,0)   * _ratio);
      _redeem_restore := FLOOR(COALESCE(_sale.points_redeemed,0) * _ratio);
      IF _earn_reversal > 0 THEN
        UPDATE public.customers SET points=GREATEST(0,points-_earn_reversal) WHERE id=_sale.customer_id;
        INSERT INTO public.point_transactions(customer_id,type,points,ref_sale_id,note,created_by)
          VALUES (_sale.customer_id,'adjust',-_earn_reversal,_sale_id,'ຍ້ອນຄືນສິນຄ້າ '||_code,_uid);
      END IF;
      IF _redeem_restore > 0 THEN
        UPDATE public.customers SET points=points+_redeem_restore WHERE id=_sale.customer_id;
        INSERT INTO public.point_transactions(customer_id,type,points,ref_sale_id,note,created_by)
          VALUES (_sale.customer_id,'adjust',_redeem_restore,_sale_id,'ຄືນແຕ້ມຍ້ອນຄືນສິນຄ້າ '||_code,_uid);
      END IF;
    END IF;
  END IF;

  RETURN _return_id;
END;$function$;