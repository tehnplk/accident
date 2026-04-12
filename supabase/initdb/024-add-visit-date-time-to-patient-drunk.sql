ALTER TABLE public.patient_drunk
ADD COLUMN IF NOT EXISTS visit_date_time text NOT NULL DEFAULT '';
