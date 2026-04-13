DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'patient_drunk'
      AND ordinal_position = 2
      AND column_name <> 'hoscode'
  ) THEN
    ALTER TABLE public.patient_drunk RENAME TO patient_drunk_old;
    ALTER TABLE public.patient_drunk_old RENAME CONSTRAINT patient_drunk_pkey TO patient_drunk_old_pkey;
    ALTER TABLE public.patient_drunk_old RENAME CONSTRAINT patient_drunk_patient_id_fkey TO patient_drunk_old_patient_id_fkey;
    ALTER TABLE public.patient_drunk_old
      RENAME CONSTRAINT patient_drunk_hoscode_patient_id_visit_date_key
      TO patient_drunk_old_hoscode_patient_id_visit_date_key;

    CREATE TABLE public.patient_drunk (
      id SERIAL PRIMARY KEY,
      hoscode text NOT NULL,
      patient_id integer NOT NULL REFERENCES public.patient(id) ON DELETE CASCADE,
      visit_date date NOT NULL,
      cc_pi text NOT NULL,
      CONSTRAINT patient_drunk_hoscode_patient_id_visit_date_key
        UNIQUE (hoscode, patient_id, visit_date)
    );

    INSERT INTO public.patient_drunk (
      id,
      hoscode,
      patient_id,
      visit_date,
      cc_pi
    )
    SELECT
      id,
      hoscode,
      patient_id,
      visit_date,
      cc_pi
    FROM public.patient_drunk_old;

    PERFORM setval(
      pg_get_serial_sequence('public.patient_drunk', 'id'),
      COALESCE((SELECT MAX(id) FROM public.patient_drunk), 1),
      (SELECT COUNT(*) > 0 FROM public.patient_drunk)
    );

    DROP TABLE public.patient_drunk_old;
  END IF;
END $$;
