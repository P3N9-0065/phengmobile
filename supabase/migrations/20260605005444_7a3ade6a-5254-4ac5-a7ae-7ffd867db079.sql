
ALTER TABLE public.sales 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid,
  ADD COLUMN IF NOT EXISTS void_reason text;

CREATE TABLE IF NOT EXISTS public.sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  return_code text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'partial',
  reason text,
  refund_amount numeric NOT NULL DEFAULT 0,
  restock boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sale_returns TO authenticated;
GRANT ALL ON public.sale_returns TO service_role;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read returns" ON public.sale_returns FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admin insert returns" ON public.sale_returns FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.sale_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items(id),
  item_id uuid,
  qty integer NOT NULL CHECK (qty > 0),
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT ON public.sale_return_items TO authenticated;
GRANT ALL ON public.sale_return_items TO service_role;
ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read return items" ON public.sale_return_items FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY "admin insert return items" ON public.sale_return_items FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS sale_return_items_return_idx ON public.sale_return_items(return_id);
CREATE INDEX IF NOT EXISTS sale_returns_sale_idx ON public.sale_returns(sale_id);

CREATE OR REPLACE FUNCTION public.gen_return_code()
RETURNS text LANGUAGE plpgsql SET search_path=public AS $f$
BEGIN
  RETURN 'RT' || to_char(now(),'YYMMDD') || lpad(floor(random()*10000)::text,4,'0');
END;$f$;

CREATE OR REPLACE FUNCTION public.return_sale_items(
  _sale_id uuid,
  _items jsonb,
  _reason text DEFAULT NULL,
  _restock boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE
  _uid uuid := auth.uid();
  _sale public.sales%ROWTYPE;
  _return_id uuid;
  _code text;
  _refund_total numeric := 0;
  _returned_qty int;
  _item record;
  _si record;
  _earn_reversal int := 0;
  _redeem_restore int := 0;
  _orig_subtotal numeric;
  _ratio numeric;
BEGIN
  IF NOT has_role(_uid,'admin') THEN RAISE EXCEPTION 'permission denied'; END IF;
  SELECT * INTO _sale FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF _sale.id IS NULL THEN RAISE EXCEPTION 'sale not found'; END IF;
  IF _sale.status = 'voided' THEN RAISE EXCEPTION 'sale already voided'; END IF;

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
END;$f$;

CREATE OR REPLACE FUNCTION public.void_sale(_sale_id uuid, _reason text DEFAULT NULL, _restock boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$
DECLARE
  _uid uuid := auth.uid();
  _items jsonb;
  _return_id uuid;
BEGIN
  IF NOT has_role(_uid,'admin') THEN RAISE EXCEPTION 'permission denied'; END IF;

  SELECT jsonb_agg(jsonb_build_object('sale_item_id', si.id, 'qty', (si.qty - COALESCE(rsum.returned,0))))
    INTO _items
    FROM public.sale_items si
    LEFT JOIN (
      SELECT sri.sale_item_id, SUM(sri.qty) AS returned
      FROM public.sale_return_items sri
      GROUP BY sri.sale_item_id
    ) rsum ON rsum.sale_item_id = si.id
    WHERE si.sale_id = _sale_id AND (si.qty - COALESCE(rsum.returned,0)) > 0;

  IF _items IS NOT NULL THEN
    _return_id := public.return_sale_items(_sale_id, _items, COALESCE(_reason,'void'), _restock);
    UPDATE public.sale_returns SET kind='void' WHERE id=_return_id;
  END IF;

  UPDATE public.sales 
    SET status='voided', voided_at=now(), voided_by=_uid, void_reason=_reason
    WHERE id=_sale_id;

  RETURN _return_id;
END;$f$;
