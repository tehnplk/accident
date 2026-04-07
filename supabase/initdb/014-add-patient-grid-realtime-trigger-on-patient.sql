drop trigger if exists trg_notify_patient_grid_change_patient on public.patient;
create trigger trg_notify_patient_grid_change_patient
after insert or update or delete
on public.patient
for each row
execute function public.notify_patient_grid_change();
