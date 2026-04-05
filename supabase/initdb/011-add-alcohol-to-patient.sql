-- Migration 011: Move alcohol field from patient_detail to patient table
-- alcohol: 1 = ดื่ม, 0 = ไม่ดื่ม/ไม่ทราบ/ไม่มีข้อมูล

ALTER TABLE public.patient
  ADD COLUMN IF NOT EXISTS alcohol smallint NOT NULL DEFAULT 0;

ALTER TABLE public.patient_detail
  DROP COLUMN IF EXISTS acd_alcohol;

ALTER TABLE public.patient_detail
  DROP COLUMN IF EXISTS acd_alcohol_addon;

-- Unique index for external client upsert by (hoscode, vn)
-- vn = visit number from HIS, used for idempotent push
CREATE UNIQUE INDEX IF NOT EXISTS patient_uk_hoscode_vn
  ON public.patient (hoscode, vn)
  WHERE vn IS NOT NULL AND vn <> '';
