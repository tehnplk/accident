-- Users table for username/password login
CREATE TABLE IF NOT EXISTS public.users (
  id          SERIAL PRIMARY KEY,
  username    TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  hcode       TEXT NOT NULL,
  hname       TEXT NOT NULL DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast username lookup
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);

-- Helper: insert a user with hashed password
-- Usage: SELECT insert_user('myuser', 'mypassword', '00051', 'โรงพยาบาลตัวอย่าง');
CREATE OR REPLACE FUNCTION insert_user(
  p_username TEXT,
  p_password TEXT,
  p_hcode    TEXT,
  p_hname    TEXT DEFAULT ''
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.users (username, password_hash, hcode, hname)
  VALUES (p_username, crypt(p_password, gen_salt('bf', 10)), p_hcode, p_hname)
  ON CONFLICT (username) DO UPDATE
    SET password_hash = crypt(p_password, gen_salt('bf', 10)),
        hcode = p_hcode,
        hname = p_hname,
        updated_at = NOW();
END;
$$;
