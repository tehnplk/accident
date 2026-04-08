ALTER TABLE public.patient
ADD COLUMN IF NOT EXISTS rejected_note text;
