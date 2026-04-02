-- Add timestamps and audit logging for public.patient

ALTER TABLE public.patient
ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.patient
ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.patient
ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.patient
ALTER COLUMN updated_at SET DEFAULT now();

UPDATE public.patient
SET
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now())
WHERE created_at IS NULL OR updated_at IS NULL;

ALTER TABLE public.patient
ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.patient
ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_patient_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := COALESCE(NEW.updated_at, now());
  ELSE
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_patient_timestamps ON public.patient;

CREATE TRIGGER trg_set_patient_timestamps
BEFORE INSERT OR UPDATE
ON public.patient
FOR EACH ROW
EXECUTE FUNCTION public.set_patient_timestamps();

CREATE TABLE IF NOT EXISTS public.patient_log (
  id bigserial PRIMARY KEY,
  patient_id bigint,
  action text NOT NULL,
  old_row jsonb,
  new_row jsonb,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL DEFAULT current_user,
  txid bigint NOT NULL DEFAULT txid_current(),
  CONSTRAINT patient_log_action_check CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX IF NOT EXISTS idx_patient_log_patient_id_changed_at
ON public.patient_log (patient_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_patient_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.patient_log (patient_id, action, old_row, new_row)
    VALUES (NEW.id, 'INSERT', NULL, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.patient_log (patient_id, action, old_row, new_row)
    VALUES (NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.patient_log (patient_id, action, old_row, new_row)
    VALUES (OLD.id, 'DELETE', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_patient_change ON public.patient;

CREATE TRIGGER trg_log_patient_change
AFTER INSERT OR UPDATE OR DELETE
ON public.patient
FOR EACH ROW
EXECUTE FUNCTION public.log_patient_change();
