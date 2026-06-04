-- Add partial receiving support
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'partial' BEFORE 'received';

ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS received_qty INTEGER NOT NULL DEFAULT 0;

-- New RPC: receive specific quantities per line item (can be called multiple times)
CREATE OR REPLACE FUNCTION public.receive_purchase_order_partial(_po_id uuid, _items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _status po_status;
  _uid uuid := auth.uid();
  _po_code text;
  _remaining_total int;
  r record;
  it record;
  recv_qty int;
  line_remaining int;
BEGIN
  IF NOT (has_role(_uid,'admin') OR has_role(_uid,'warehouse')) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  SELECT status, po_code INTO _status, _po_code FROM purchase_orders WHERE id = _po_id FOR UPDATE;
  IF _status IS NULL THEN RAISE EXCEPTION 'PO not found'; END IF;
  IF _status NOT IN ('draft','partial') THEN RAISE EXCEPTION 'PO already %', _status; END IF;

  FOR r IN SELECT (e->>'item_id')::uuid AS item_id, (e->>'qty')::int AS qty
           FROM jsonb_array_elements(_items) e
  LOOP
    IF r.qty IS NULL OR r.qty <= 0 THEN CONTINUE; END IF;

    SELECT poi.id, poi.qty, poi.received_qty, poi.unit_cost
      INTO it
      FROM purchase_order_items poi
      WHERE poi.po_id = _po_id AND poi.item_id = r.item_id
      FOR UPDATE;
    IF it.id IS NULL THEN RAISE EXCEPTION 'item % not in PO', r.item_id; END IF;

    line_remaining := it.qty - it.received_qty;
    IF line_remaining <= 0 THEN CONTINUE; END IF;
    recv_qty := LEAST(r.qty, line_remaining);

    INSERT INTO stock_movements(item_id, qty, type, note, created_by)
    VALUES (r.item_id, recv_qty, 'purchase', 'PO ' || _po_code, _uid);

    UPDATE inventory_items SET cost_price = it.unit_cost, updated_at = now()
      WHERE id = r.item_id AND it.unit_cost > 0;

    UPDATE purchase_order_items SET received_qty = received_qty + recv_qty
      WHERE id = it.id;
  END LOOP;

  SELECT COALESCE(SUM(qty - received_qty), 0) INTO _remaining_total
    FROM purchase_order_items WHERE po_id = _po_id;

  IF _remaining_total <= 0 THEN
    UPDATE purchase_orders SET status='received', received_at=now(), received_by=_uid, updated_at=now()
      WHERE id = _po_id;
  ELSE
    UPDATE purchase_orders SET status='partial', updated_at=now()
      WHERE id = _po_id AND status = 'draft';
  END IF;
END;
$$;

-- Rewrite full-receive RPC to use the partial mechanism (receive all remaining)
CREATE OR REPLACE FUNCTION public.receive_purchase_order(_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _items jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('item_id', item_id, 'qty', (qty - received_qty)))
    INTO _items
    FROM purchase_order_items
    WHERE po_id = _po_id AND (qty - received_qty) > 0;
  IF _items IS NULL THEN RAISE EXCEPTION 'nothing to receive'; END IF;
  PERFORM receive_purchase_order_partial(_po_id, _items);
END;
$$;