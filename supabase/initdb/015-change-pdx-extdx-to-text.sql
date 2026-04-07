ALTER TABLE public.patient
ALTER COLUMN pdx TYPE text USING
  CASE
    WHEN pdx IS NULL THEN NULL
    WHEN jsonb_typeof(pdx) = 'string' THEN trim(both '"' from pdx::text)
    ELSE pdx::text
  END;

ALTER TABLE public.patient
ALTER COLUMN ext_dx TYPE text USING
  CASE
    WHEN ext_dx IS NULL THEN NULL
    WHEN jsonb_typeof(ext_dx) = 'string' THEN trim(both '"' from ext_dx::text)
    ELSE ext_dx::text
  END;
