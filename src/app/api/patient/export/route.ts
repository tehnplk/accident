import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/authConfig";
import { dbQuery } from "@/lib/db";
import { parseProfileFromSession } from "@/lib/activity-log";
import { extractProfileOrganizationHcodes } from "@/lib/hospital-access";
import {
  getPatientAesSecret,
  patientApiAuthorized,
  patientDecryptedColumnSql,
} from "@/lib/patient-security";

export const runtime = "nodejs";

type ExportRow = {
  id: number;
  patient_name: string | null;
  cid: string | null;
  visit_date: string | null;
  visit_time: string | null;
  age: number | null;
  sex: string | null;
  cc: string | null;
  status: string | null;
  triage: string | null;
  house_no: string | null;
  moo: string | null;
  tumbon: string | null;
  amphoe: string | null;
  changwat: string | null;
  pdx: unknown;
  ext_dx: unknown;
  location_road: string | null;
  location_detail: string | null;
  alcohol: number | null;
  acd_vihicle_label: string | null;
  acd_vihicle_export_label: string | null;
  acd_vihicle_counterpart_label: string | null;
  acd_road_export_label: string | null;
  acd_measure_export_label: string | null;
  acd_transfer_export_label: string | null;
  acd_result_export_label: string | null;
  acd_refer_export_label: string | null;
};

function formatVisitDateTime(visitDate: string | null, visitTime: string | null) {
  const dateMatch = (visitDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = (visitTime ?? "").match(/^(\d{2}):(\d{2})/);
  const monthLabels = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  let dateLabel = visitDate ?? "-";

  if (dateMatch) {
    const year = Number.parseInt(dateMatch[1], 10);
    const month = Number.parseInt(dateMatch[2], 10);
    const day = dateMatch[3];
    const monthLabel = monthLabels[month - 1];

    if (monthLabel && Number.isFinite(year)) {
      dateLabel = `${day}${monthLabel}${String((year + 543) % 100).padStart(2, "0")}`;
    }
  }

  const timeLabel = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : (visitTime ?? "-");
  return `${dateLabel} ${timeLabel}`.trim();
}

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function formatLocationRoad(road: string | null, detail: string | null) {
  const parts = [normalizeText(road), normalizeText(detail)].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "-";
}

function formatAddress(row: ExportRow) {
  const houseNo = normalizeText(row.house_no);
  const moo = normalizeText(row.moo);
  const tumbon = normalizeText(row.tumbon);
  const amphoe = normalizeText(row.amphoe);
  const changwat = normalizeText(row.changwat);

  const parts = [
    houseNo ? `บ้านเลขที่ ${houseNo}` : "",
    moo ? `หมู่ ${moo}` : "",
    tumbon || "",
    amphoe || "",
    changwat || "",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("/") : "-";
}

function formatDiagnosisEntry(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const row = value as { code?: unknown; name?: unknown };
  const code = typeof row.code === "string" ? row.code.trim() : "";
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (code && name) return `${code} - ${name}`;
  return code || name;
}

function formatDiagnosis(pdx: unknown, extDx: unknown) {
  const parts = [formatDiagnosisEntry(pdx), formatDiagnosisEntry(extDx)].filter(Boolean);
  return parts.length > 0 ? parts.join(" ; ") : "-";
}

function parseExportFilters(params: URLSearchParams) {
  return {
    hospital: params.get("hospital")?.trim() ?? "",
    name: params.get("name")?.trim() ?? "",
    hn: params.get("hn")?.trim() ?? "",
    area: params.get("area")?.trim() ?? "",
    vehicle: params.get("vehicle")?.trim() ?? "",
    alcohol: params.get("alcohol")?.trim() ?? "",
    sex: params.get("sex")?.trim() ?? "",
    sortBy:
      params.get("sortBy") === "age"
        ? "age"
        : params.get("sortBy") === "created_at"
          ? "created_at"
          : params.get("sortBy") === "visit_date"
            ? "visit_date"
            : "visit_date_time",
    sortDir: params.get("sortDir") === "asc" ? "asc" : "desc",
  } as const;
}

export async function GET(request: NextRequest) {
  try {
    if (!patientApiAuthorized(request)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const session = await auth();
    const profile = parseProfileFromSession(session);
    const userHoscodes = extractProfileOrganizationHcodes(profile);
    const hasFullHoscodeAccess = userHoscodes.includes("00051");
    if (!hasFullHoscodeAccess && userHoscodes.length === 0) {
      return NextResponse.json(
        { message: "Forbidden: no hospital code is assigned for export scope" },
        { status: 403 },
      );
    }

    const filters = parseExportFilters(request.nextUrl.searchParams);
    const aesSecret = getPatientAesSecret();
    const filterValues: unknown[] = [];
    const whereParts: string[] = [];
    const scopedHoscodes = hasFullHoscodeAccess ? null : userHoscodes;
    const hospitalParam = filters.hospital ? `%${filters.hospital}%` : null;
    const nameParam = filters.name ? `%${filters.name}%` : null;
    const hnParam = filters.hn ? `%${filters.hn}%` : null;
    const areaParam = filters.area || null;
    const vehicleParam = filters.vehicle || null;
    const alcoholParam = filters.alcohol || null;
    const sexParam = filters.sex || null;

    if (scopedHoscodes) filterValues.push(scopedHoscodes);
    if (hospitalParam) filterValues.push(hospitalParam);
    if (nameParam) filterValues.push(nameParam);
    if (hnParam) filterValues.push(hnParam);
    if (areaParam) filterValues.push(areaParam);
    if (vehicleParam) filterValues.push(vehicleParam);
    if (alcoholParam) filterValues.push(alcoholParam);
    if (sexParam) filterValues.push(sexParam);

    const dataSecretParamIndex = filterValues.length + 1;
    const decryptedPatientNameSql = patientDecryptedColumnSql("patient_name", dataSecretParamIndex);
    const decryptedHnSql = patientDecryptedColumnSql("hn", dataSecretParamIndex);
    const decryptedCidSql = patientDecryptedColumnSql("cid", dataSecretParamIndex);
    let paramIndex = 0;

    if (scopedHoscodes) {
      paramIndex += 1;
      whereParts.push(`p.hoscode = ANY($${paramIndex}::text[])`);
    }
    if (hospitalParam) {
      paramIndex += 1;
      whereParts.push(`p.hosname ILIKE $${paramIndex}`);
    }
    if (nameParam) {
      paramIndex += 1;
      whereParts.push(`${decryptedPatientNameSql} ILIKE $${paramIndex}`);
    }
    if (hnParam) {
      paramIndex += 1;
      whereParts.push(`${decryptedHnSql} ILIKE $${paramIndex}`);
    }
    if (areaParam) {
      paramIndex += 1;
      whereParts.push(`loc.area = $${paramIndex}`);
    }
    if (vehicleParam) {
      paramIndex += 1;
      whereParts.push(`detail.acd_vihicle_label = $${paramIndex}`);
    }
    if (alcoholParam) {
      paramIndex += 1;
      whereParts.push(`p.alcohol = $${paramIndex}::smallint`);
    }
    if (sexParam) {
      paramIndex += 1;
      whereParts.push(`p.sex = $${paramIndex}`);
    }

    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
    const orderBy =
      filters.sortBy === "age"
        ? `p.age ${filters.sortDir.toUpperCase()} NULLS LAST, p.id ${filters.sortDir.toUpperCase()}`
        : filters.sortBy === "created_at"
          ? `p.created_at ${filters.sortDir.toUpperCase()} NULLS LAST, p.id ${filters.sortDir.toUpperCase()}`
          : filters.sortBy === "visit_date"
            ? `p.visit_date ${filters.sortDir.toUpperCase()}, p.id ${filters.sortDir.toUpperCase()}`
            : `p.visit_date ${filters.sortDir.toUpperCase()}, p.visit_time ${filters.sortDir.toUpperCase()}, p.id ${filters.sortDir.toUpperCase()}`;

    const baseFrom = `
      FROM public.patient p
      LEFT JOIN LATERAL (
        SELECT
          d.name_in_thai AS area,
          s.name_in_thai AS subdistrict_name,
          pv.name_in_thai AS province_name,
          l.road AS location_road,
          l.detail AS location_detail
        FROM public.patient_acd_location l
        LEFT JOIN public.districts d ON d.code::text = l.amp_code
        LEFT JOIN public.subdistricts s ON s.code::text = l.tmb_code
        LEFT JOIN public.provinces pv ON pv.code::text = l.prov_code
        WHERE l.patient_id = p.id
        ORDER BY l.id DESC
        LIMIT 1
      ) loc ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(NULLIF(pd.acd_vihicle_addon, ''), av.name) AS acd_vihicle_label,
          CASE
            WHEN pd.acd_vihicle IS NOT NULL AND av.name IS NOT NULL AND NULLIF(pd.acd_vihicle_addon, '') IS NOT NULL
              THEN CONCAT(pd.acd_vihicle::text, '-', av.name, ' (', pd.acd_vihicle_addon, ')')
            WHEN pd.acd_vihicle IS NOT NULL AND av.name IS NOT NULL
              THEN CONCAT(pd.acd_vihicle::text, '-', av.name)
            ELSE NULL
          END AS acd_vihicle_export_label,
          CASE
            WHEN NULLIF(pd.acd_vihicle_counterpart, '') IS NOT NULL AND avc.name IS NOT NULL AND NULLIF(pd.acd_vihicle_counterpart_addon, '') IS NOT NULL
              THEN CONCAT(pd.acd_vihicle_counterpart, '-', avc.name, ' (', pd.acd_vihicle_counterpart_addon, ')')
            WHEN NULLIF(pd.acd_vihicle_counterpart, '') IS NOT NULL AND avc.name IS NOT NULL
              THEN CONCAT(pd.acd_vihicle_counterpart, '-', avc.name)
            WHEN NULLIF(pd.acd_vihicle_counterpart, '') IS NOT NULL AND NULLIF(pd.acd_vihicle_counterpart_addon, '') IS NOT NULL
              THEN CONCAT(pd.acd_vihicle_counterpart, ' (', pd.acd_vihicle_counterpart_addon, ')')
            ELSE NULLIF(pd.acd_vihicle_counterpart, '')
          END AS acd_vihicle_counterpart_label,
          CASE
            WHEN pd.acd_road IS NOT NULL AND ar.name IS NOT NULL AND NULLIF(pd.acd_road_addon, '') IS NOT NULL
              THEN CONCAT(pd.acd_road::text, '-', ar.name, ' (', pd.acd_road_addon, ')')
            WHEN pd.acd_road IS NOT NULL AND ar.name IS NOT NULL
              THEN CONCAT(pd.acd_road::text, '-', ar.name)
            ELSE NULL
          END AS acd_road_export_label,
          CASE
            WHEN pd.acd_measure IS NOT NULL AND am.name IS NOT NULL AND NULLIF(pd.acd_measure_addon, '') IS NOT NULL
              THEN CONCAT(pd.acd_measure::text, '-', am.name, ' (', pd.acd_measure_addon, ')')
            WHEN pd.acd_measure IS NOT NULL AND am.name IS NOT NULL
              THEN CONCAT(pd.acd_measure::text, '-', am.name)
            ELSE NULL
          END AS acd_measure_export_label,
          CASE
            WHEN pd.acd_transfer IS NOT NULL AND atr.name IS NOT NULL AND NULLIF(pd.acd_transfer_addon, '') IS NOT NULL
              THEN CONCAT(pd.acd_transfer::text, '-', atr.name, ' (', pd.acd_transfer_addon, ')')
            WHEN pd.acd_transfer IS NOT NULL AND atr.name IS NOT NULL
              THEN CONCAT(pd.acd_transfer::text, '-', atr.name)
            ELSE NULL
          END AS acd_transfer_export_label,
          CASE
            WHEN pd.acd_result IS NOT NULL AND ars.name IS NOT NULL AND NULLIF(pd.acd_result_addon, '') IS NOT NULL
              THEN CONCAT(pd.acd_result::text, '-', ars.name, ' (', pd.acd_result_addon, ')')
            WHEN pd.acd_result IS NOT NULL AND ars.name IS NOT NULL
              THEN CONCAT(pd.acd_result::text, '-', ars.name)
            ELSE NULL
          END AS acd_result_export_label,
          CASE
            WHEN pd.acd_refer IS NOT NULL AND arf.name IS NOT NULL AND NULLIF(pd.acd_refer_addon, '') IS NOT NULL
              THEN CONCAT(pd.acd_refer::text, '-', arf.name, ' (', pd.acd_refer_addon, ')')
            WHEN pd.acd_refer IS NOT NULL AND arf.name IS NOT NULL
              THEN CONCAT(pd.acd_refer::text, '-', arf.name)
            ELSE NULL
          END AS acd_refer_export_label
        FROM public.patient_detail pd
        LEFT JOIN public.acd_type at ON at.code = pd.acd_type
        LEFT JOIN public.acd_vihicle av ON av.code = pd.acd_vihicle
        LEFT JOIN public.acd_vihicle avc
          ON avc.code = CASE
            WHEN NULLIF(pd.acd_vihicle_counterpart, '') ~ '^[0-9]+$' THEN NULLIF(pd.acd_vihicle_counterpart, '')::int
            ELSE NULL
          END
        LEFT JOIN public.acd_road ar ON ar.code = pd.acd_road
        LEFT JOIN public.acd_measure am ON am.code = pd.acd_measure
        LEFT JOIN public.acd_transfer atr ON atr.code = pd.acd_transfer
        LEFT JOIN public.acd_result ars ON ars.code = pd.acd_result
        LEFT JOIN public.acd_refer arf ON arf.code = pd.acd_refer
        WHERE pd.patient_id = p.id
        LIMIT 1
      ) detail ON TRUE
    `;

    const query = `
      SELECT
        p.id,
        ${decryptedPatientNameSql} AS patient_name,
        ${decryptedCidSql} AS cid,
        to_char(p.visit_date, 'YYYY-MM-DD') AS visit_date,
        to_char(p.visit_time, 'HH24:MI:SS') AS visit_time,
        p.age,
        p.sex,
        p.cc,
        p.status,
        p.triage,
        p.house_no,
        p.moo,
        COALESCE(loc.subdistrict_name, p.tumbon) AS tumbon,
        loc.area AS amphoe,
        COALESCE(loc.province_name, p.changwat) AS changwat,
        p.pdx,
        p.ext_dx,
        loc.location_road,
        loc.location_detail,
        p.alcohol,
        detail.acd_vihicle_label,
        detail.acd_vihicle_export_label,
        detail.acd_vihicle_counterpart_label,
        detail.acd_road_export_label,
        detail.acd_measure_export_label,
        detail.acd_transfer_export_label,
        detail.acd_result_export_label,
        detail.acd_refer_export_label
      ${baseFrom}
      ${whereClause}
      ORDER BY ${orderBy}
    `;

    const result = await dbQuery<ExportRow>(query, [...filterValues, aesSecret]);
    const exportRows = result.rows.map((row) => ({
      "วันที่มาถึงรพ./เวลา": formatVisitDateTime(row.visit_date, row.visit_time),
      "ชื่อ-นามสกุล": row.patient_name ?? "-",
      "เลขบัตรประชาชน": row.cid ?? "-",
      "วินิจฉัย (Diagnosis)": formatDiagnosis(row.pdx, row.ext_dx),
      "อาการสำคัญ": row.cc ?? "-",
      "การคัดแยก(Triage)": row.triage ?? "-",
      "ภูมิลำเนา บ้านเลขที่/ตำบล/อำเภอ/จังหวัด": formatAddress(row),
      "ถนนที่เกิดเหตุ": formatLocationRoad(row.location_road, row.location_detail),
      อายุ: row.age ?? "-",
      เพศ: row.sex ?? "-",
      "1 สถานะ (status)": row.status ?? "-",
      "2.1 ยานพาหนะ ผู้บาดเจ็บ": row.acd_vihicle_export_label ?? "-",
      "2.2 ยานพาหนะ คู่กรณี": row.acd_vihicle_counterpart_label ?? "-",
      "3 ถนน": row.acd_road_export_label ?? "-",
      "4 มาตรการ": row.acd_measure_export_label ?? "-",
      "5 สุรา": row.alcohol === 1 ? "ดื่ม" : row.alcohol === 0 ? "ไม่ดื่ม" : "-",
      "6 นำส่ง/EMS": row.acd_transfer_export_label ?? "-",
      "7 ผลการรักษา": row.acd_result_export_label ?? "-",
      "8 ส่งต่อไปยัง": row.acd_refer_export_label ?? "-",
    }));

    const reportTitle = "รายงานชื่อผู้บาดเจ็บและเสียชีวิตจากอุบัติเหตุทางถนน";
    const worksheet = XLSX.utils.aoa_to_sheet([[reportTitle], []]);
    XLSX.utils.sheet_add_json(worksheet, exportRows, { origin: "A3" });
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 18 } }];
    if (worksheet.A1) {
      worksheet.A1.s = {
        alignment: { horizontal: "center", vertical: "center" },
        font: { bold: true, sz: 16 },
      };
    }
    worksheet["!cols"] = [
      { wch: 20 },
      { wch: 22 },
      { wch: 18 },
      { wch: 28 },
      { wch: 24 },
      { wch: 18 },
      { wch: 36 },
      { wch: 20 },
      { wch: 8 },
      { wch: 8 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
    ];
    worksheet["!rows"] = [{ hpt: 24 }, { hpt: 8 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "patient");

    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
    ].join("");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(buffer as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"patient-export-${stamp}.xlsx\"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: "Failed to export patient xlsx",
        error: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
