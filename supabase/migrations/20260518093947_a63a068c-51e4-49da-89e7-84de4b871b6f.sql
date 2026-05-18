
DROP TRIGGER IF EXISTS trg_ticket_status ON public.repair_tickets;

CREATE OR REPLACE FUNCTION public.set_ticket_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'picked_up' AND NEW.picked_up_at IS NULL THEN
      NEW.picked_up_at := now();
      IF NEW.warranty_until IS NULL THEN
        NEW.warranty_until := (now() + (NEW.warranty_days || ' days')::interval)::date;
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_ticket_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.repair_status_history(ticket_id, status, changed_by)
    VALUES (NEW.id, NEW.status, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.repair_status_history(ticket_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_ticket_before
BEFORE INSERT OR UPDATE ON public.repair_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_ticket_updated_at();

CREATE TRIGGER trg_ticket_status
AFTER INSERT OR UPDATE ON public.repair_tickets
FOR EACH ROW EXECUTE FUNCTION public.record_ticket_status_change();
