ALTER TABLE public.patient_drunk
ADD COLUMN IF NOT EXISTS hoscode text,
ADD COLUMN IF NOT EXISTS visit_date date;

UPDATE public.patient_drunk pd
SET
  hoscode = p.hoscode,
  visit_date = p.visit_date
FROM public.patient p
WHERE pd.patient_id = p.id
  AND (pd.hoscode IS NULL OR pd.visit_date IS NULL);

ALTER TABLE public.patient_drunk
ALTER COLUMN hoscode SET NOT NULL,
ALTER COLUMN visit_date SET NOT NULL;

ALTER TABLE public.patient_drunk
DROP CONSTRAINT IF EXISTS patient_drunk_patient_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'patient_drunk'
      AND constraint_name = 'patient_drunk_hoscode_patient_id_visit_date_key'
  ) THEN
    ALTER TABLE public.patient_drunk
    ADD CONSTRAINT patient_drunk_hoscode_patient_id_visit_date_key
    UNIQUE (hoscode, patient_id, visit_date);
  END IF;
END $$;
