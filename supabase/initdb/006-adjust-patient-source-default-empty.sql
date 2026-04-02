-- Change patient.source default to empty string
-- Keep manual entries as 'man' and allow explicit 'auto' when set by system jobs.

ALTER TABLE public.patient
ALTER COLUMN source SET DEFAULT '';

ALTER TABLE public.patient
DROP CONSTRAINT IF EXISTS patient_source_check;

ALTER TABLE public.patient
ADD CONSTRAINT patient_source_check
CHECK (source IN ('', 'auto', 'man'));
