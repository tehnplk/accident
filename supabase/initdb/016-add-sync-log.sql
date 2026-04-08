CREATE TABLE IF NOT EXISTS public.sync_log (
  id bigserial PRIMARY KEY,
  date_time timestamptz NOT NULL DEFAULT now(),
  hoscode text,
  hosname text,
  num_pt_case integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sync_log_date_time
ON public.sync_log (date_time DESC);

CREATE INDEX IF NOT EXISTS idx_sync_log_hoscode_date_time
ON public.sync_log (hoscode, date_time DESC);
