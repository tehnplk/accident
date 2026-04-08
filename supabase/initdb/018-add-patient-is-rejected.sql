ALTER TABLE public.patient
ADD COLUMN IF NOT EXISTS is_rejected boolean NOT NULL DEFAULT false;
