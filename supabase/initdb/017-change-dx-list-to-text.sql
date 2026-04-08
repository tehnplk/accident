ALTER TABLE public.patient
  ALTER COLUMN dx_list TYPE text
  USING CASE
    WHEN dx_list IS NULL THEN NULL
    ELSE dx_list::text
  END;
