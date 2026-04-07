source ~/.bashrc
source ~/.profile
cd ~/accident
node - <<'NODE'
const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:55432/accident' });
  await c.connect();
  await c.query('TRUNCATE TABLE public.patient_log, public.patient_acd_location, public.patient_detail, public.patient RESTART IDENTITY CASCADE');
  const r = await c.query(`select 'patient' as table_name, count(*)::int as total from public.patient
    union all select 'patient_acd_location', count(*)::int from public.patient_acd_location
    union all select 'patient_detail', count(*)::int from public.patient_detail
    union all select 'patient_log', count(*)::int from public.patient_log
    order by table_name`);
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch(err => { console.error(err); process.exit(1); });
NODE