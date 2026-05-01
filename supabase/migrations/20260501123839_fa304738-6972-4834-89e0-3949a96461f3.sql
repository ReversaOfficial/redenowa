
-- Add report counters to profiles
ALTER TABLE public.profiles
  ADD COLUMN valid_reports_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN invalid_reports_count INTEGER NOT NULL DEFAULT 0;

-- Trigger function to update counters when a report status changes
CREATE OR REPLACE FUNCTION public.update_reporter_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_status TEXT;
  new_status TEXT;
BEGIN
  old_status := COALESCE(OLD.status::TEXT, '');
  new_status := NEW.status::TEXT;

  -- Skip if status didn't change
  IF old_status = new_status THEN
    RETURN NEW;
  END IF;

  -- Decrement old status counter
  IF old_status IN ('reviewed_valid', 'actioned') THEN
    UPDATE public.profiles
    SET valid_reports_count = GREATEST(valid_reports_count - 1, 0)
    WHERE id = NEW.reporter_id;
  ELSIF old_status = 'reviewed_invalid' THEN
    UPDATE public.profiles
    SET invalid_reports_count = GREATEST(invalid_reports_count - 1, 0)
    WHERE id = NEW.reporter_id;
  END IF;

  -- Increment new status counter
  IF new_status IN ('reviewed_valid', 'actioned') THEN
    UPDATE public.profiles
    SET valid_reports_count = valid_reports_count + 1
    WHERE id = NEW.reporter_id;
  ELSIF new_status = 'reviewed_invalid' THEN
    UPDATE public.profiles
    SET invalid_reports_count = invalid_reports_count + 1
    WHERE id = NEW.reporter_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_reporter_counts
AFTER UPDATE ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.update_reporter_counts();
