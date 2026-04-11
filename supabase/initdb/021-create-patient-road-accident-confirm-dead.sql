CREATE TABLE IF NOT EXISTS public.patient_road_accident_confirm_dead (
  id SERIAL PRIMARY KEY,
  patient_id integer NOT NULL UNIQUE REFERENCES public.patient(id) ON DELETE CASCADE,
  patient_cc_pi text NOT NULL,
  patient_status text NOT NULL
);
