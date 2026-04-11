-- Migration 011: Move alcohol field from patient_detail to patient table
-- alcohol: 1 = ดื่ม, 0 = ไม่ดื่ม/ไม่ทราบ/ไม่มีข้อมูล

ALTER TABLE public.patient
  ADD COLUMN IF NOT EXISTS alcohol smallint NOT NULL DEFAULT 0;

ALTER TABLE public.patient_detail
  DROP COLUMN IF EXISTS acd_alcohol;

ALTER TABLE public.patient_detail
  DROP COLUMN IF EXISTS acd_alcohol_addon;

-- Removed: patient_uk_hoscode_vn unique index
-- Uniqueness is now enforced only by patient_uk_hoscode_cid_visitdate (hoscode, cid_hash, visit_date)
