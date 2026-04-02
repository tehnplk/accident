create or replace function public.notify_patient_grid_change()
returns trigger
language plpgsql
as $$
declare
  payload text;
begin
  payload := json_build_object(
    'table', tg_table_name,
    'operation', tg_op
  )::text;

  perform pg_notify('patient_grid_change', payload);

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_patient_grid_change_location on public.patient_acd_location;
create trigger trg_notify_patient_grid_change_location
after insert or update or delete
on public.patient_acd_location
for each row
execute function public.notify_patient_grid_change();

drop trigger if exists trg_notify_patient_grid_change_detail on public.patient_detail;
create trigger trg_notify_patient_grid_change_detail
after insert or update or delete
on public.patient_detail
for each row
execute function public.notify_patient_grid_change();
