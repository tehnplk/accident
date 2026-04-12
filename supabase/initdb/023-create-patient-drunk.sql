CREATE TABLE IF NOT EXISTS public.patient_drunk (
  id SERIAL PRIMARY KEY,
  patient_id integer NOT NULL UNIQUE REFERENCES public.patient(id) ON DELETE CASCADE,
  cc_pi text NOT NULL
);
