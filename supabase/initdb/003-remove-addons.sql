WITH addon_values AS (
  SELECT
    patient_id,
    MAX(CASE WHEN acd_name = 'acd_type' THEN addon_value END) AS acd_type_addon,
    MAX(CASE WHEN acd_name = 'acd_vihicle' THEN addon_value END) AS acd_vihicle_addon,
    MAX(CASE WHEN acd_name = 'acd_road' THEN addon_value END) AS acd_road_addon,
    MAX(CASE WHEN acd_name = 'acd_measure' THEN addon_value END) AS acd_measure_addon,
    MAX(CASE WHEN acd_name = 'acd_alcohol' THEN addon_value END) AS acd_alcohol_addon,
    MAX(CASE WHEN acd_name = 'acd_transfer' THEN addon_value END) AS acd_transfer_addon,
    MAX(CASE WHEN acd_name = 'acd_result' THEN addon_value END) AS acd_result_addon,
    MAX(CASE WHEN acd_name = 'acd_refer' THEN addon_value END) AS acd_refer_addon
  FROM public.addons
  GROUP BY patient_id
)
INSERT INTO public.patient_detail (
  patient_id,
  acd_type_addon,
  acd_vihicle_addon,
  acd_road_addon,
  acd_measure_addon,
  acd_alcohol_addon,
  acd_transfer_addon,
  acd_result_addon,
  acd_refer_addon,
  updated_at
)
SELECT
  patient_id,
  acd_type_addon,
  acd_vihicle_addon,
  acd_road_addon,
  acd_measure_addon,
  acd_alcohol_addon,
  acd_transfer_addon,
  acd_result_addon,
  acd_refer_addon,
  now()
FROM addon_values
ON CONFLICT (patient_id) DO UPDATE SET
  acd_type_addon = COALESCE(EXCLUDED.acd_type_addon, public.patient_detail.acd_type_addon),
  acd_vihicle_addon = COALESCE(EXCLUDED.acd_vihicle_addon, public.patient_detail.acd_vihicle_addon),
  acd_road_addon = COALESCE(EXCLUDED.acd_road_addon, public.patient_detail.acd_road_addon),
  acd_measure_addon = COALESCE(EXCLUDED.acd_measure_addon, public.patient_detail.acd_measure_addon),
  acd_alcohol_addon = COALESCE(EXCLUDED.acd_alcohol_addon, public.patient_detail.acd_alcohol_addon),
  acd_transfer_addon = COALESCE(EXCLUDED.acd_transfer_addon, public.patient_detail.acd_transfer_addon),
  acd_result_addon = COALESCE(EXCLUDED.acd_result_addon, public.patient_detail.acd_result_addon),
  acd_refer_addon = COALESCE(EXCLUDED.acd_refer_addon, public.patient_detail.acd_refer_addon),
  updated_at = now();

DROP TABLE IF EXISTS public.addons;
