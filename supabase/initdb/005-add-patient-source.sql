-- Add source field for patient origin tracking
-- auto = system/import, man = manual entry from modal form

ALTER TABLE public.patient
ADD COLUMN IF NOT EXISTS source text;

UPDATE public.patient
SET source = 'auto'
WHERE source IS NULL OR btrim(source) = '';

ALTER TABLE public.patient
ALTER COLUMN source SET DEFAULT 'auto';

ALTER TABLE public.patient
ALTER COLUMN source SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'patient_source_check'
      AND conrelid = 'public.patient'::regclass
  ) THEN
    ALTER TABLE public.patient
    ADD CONSTRAINT patient_source_check
    CHECK (source IN ('auto', 'man'));
  END IF;
END $$;
