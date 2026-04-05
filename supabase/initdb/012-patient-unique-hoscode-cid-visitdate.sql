-- Migration 012: Add cid_hash for deduplication + unique constraint (hoscode, cid, visit_date)
-- cid is encrypted with random IV so we cannot unique-index the cipher column directly.
-- cid_hash stores SHA-256 of the plaintext CID for deterministic comparison.

ALTER TABLE public.patient
  ADD COLUMN IF NOT EXISTS cid_hash text;

-- Unique constraint: one patient (hoscode + CID + visit_date) per record.
-- Partial index excludes rows where any key part is null (legacy / incomplete data).
CREATE UNIQUE INDEX IF NOT EXISTS patient_uk_hoscode_cid_visitdate
  ON public.patient (hoscode, cid_hash, visit_date)
  WHERE hoscode IS NOT NULL AND cid_hash IS NOT NULL AND visit_date IS NOT NULL;
