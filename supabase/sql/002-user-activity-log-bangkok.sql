create or replace view public.user_activity_log_bangkok as
select
  id,
  provider_id,
  full_name,
  department,
  route,
  to_char(accessed_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') as accessed_at_bangkok
from public.user_activity_log;
