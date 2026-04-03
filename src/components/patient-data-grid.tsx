"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, FileText, MapPin, Pencil, Plus, Save, Trash2, X } from "lucide-react";

export type PatientRow = {
  id: number;
  hoscode: string | null;
  hosname: string | null;
  hn: string | null;
  cid: string | null;
  patient_name: string | null;
  visit_date: string | null;
  visit_time: string | null;
  shift_name: string | null;
  sex: string | null;
  age: number | null;
  house_no: string | null;
  moo: string | null;
  road: string | null;
  tumbon: string | null;
  amphoe: string | null;
  changwat: string | null;
  cc: string | null;
  status: string | null;
  triage: string | null;
  vehicle: string | null;
  alcohol: string | null;
  area: string | null;
  created_at: string | null;
  updated_at: string | null;
  source: string | null;
  pdx: { code?: string; name?: string } | null;
  ext_dx: { code?: string; name?: string } | null;
};

type GridResponse = {
  rows: PatientRow[];
  page: number;
  pageSize: number;
  total: number;
};

type CreatePatientResponse = {
  row?: PatientRow;
  message?: string;
};

export type PatientEditDraft = {
  changwat: string;
  amphoe: string;
  tumbon: string;
  moo: string;
  road: string;
  cc: string;
};

type ThaiAddressOption = {
  id: number;
  code: number;
  name: string;
  province_id?: number | null;
  district_id?: number | null;
};

type ThaiAddressDefaultSelection = {
  province_id: number;
  province_code: number;
  province_name: string;
  district_id: number;
  district_code: number;
  district_name: string;
};

type AcdOption = {
  acd_name: string;
  code: number;
  name: string;
  is_addon: boolean;
};

type PatientDetailDraftItem = {
  code: string;
  addon_value: string;
};

type PatientDetailRow = {
  id: number;
  patient_id: number;
  acd_type: number | null;
  acd_type_addon: string | null;
  acd_vihicle: number | null;
  acd_vihicle_addon: string | null;
  acd_road: number | null;
  acd_road_addon: string | null;
  acd_measure: number | null;
  acd_measure_addon: string | null;
  acd_alcohol: number | null;
  acd_alcohol_addon: string | null;
  acd_transfer: number | null;
  acd_transfer_addon: string | null;
  acd_result: number | null;
  acd_result_addon: string | null;
  acd_refer: number | null;
  acd_refer_addon: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type HospitalOption = {
  hoscode: string | null;
  hosname: string;
};

type PatientCreateDraft = {
  hoscode: string;
  hosname: string;
  hn: string;
  cid: string;
  patient_name: string;
  visit_date: string;
  visit_time: string;
  sex: string;
  age: string;
  triage: string;
  status: string;
  cc: string;
};

const ACD_GROUPS = [
  { name: "acd_type", label: "ประเภทผู้ประสบเหตุ" },
  { name: "acd_vihicle", label: "ยานพาหนะ" },
  { name: "acd_road", label: "ถนน" },
  { name: "acd_measure", label: "มาตรการ" },
  { name: "acd_alcohol", label: "สุรา" },
  { name: "acd_transfer", label: "นำส่ง/EMS" },
  { name: "acd_result", label: "ผลการรักษา" },
  { name: "acd_refer", label: "Refer/Admit" },
] as const;

type AcdGroupName = (typeof ACD_GROUPS)[number]["name"];

const PAGE_OPTIONS = [20, 50, 100];
const DEFAULT_PROVINCE_CODE = "65";
const DEFAULT_PROVINCE_NAME = "พิษณุโลก";
const PATIENT_REALTIME_MODE = process.env.NEXT_PUBLIC_PATIENT_REALTIME_MODE ?? "auto";
const PATIENT_POLL_INTERVAL_MS = Number.parseInt(
  process.env.NEXT_PUBLIC_PATIENT_POLL_INTERVAL_MS ?? "30000",
  10,
);
const PATIENT_STREAM_RETRY_MS = Number.parseInt(
  process.env.NEXT_PUBLIC_PATIENT_STREAM_RETRY_MS ?? "5000",
  10,
);
const EMPTY_DRAFT: PatientEditDraft = {
  changwat: "",
  amphoe: "",
  tumbon: "",
  moo: "",
  road: "",
  cc: "",
};
const DEFAULT_TRIAGE_OPTIONS = [
  "Resuscitation (วิกฤต)",
  "Emergency (ฉุกเฉิน)",
  "Urgency (เร่งด่วน)",
  "Semi Urgency (กึ่งเร่งด่วน)",
  "Non Urgency (รอได้)",
  "-",
] as const;
const DEFAULT_STATUS_OPTIONS = ["กลับบ้าน", "รับไว้รักษา", "ส่งต่อ", "เสียชีวิต", "-"] as const;

export type FilterState = {
  hospital: string;
  name: string;
  hn: string;
  area: string;
  vehicle: string;
  alcohol: string;
  sex: string;
  sortBy: "visit_date" | "visit_date_time" | "age" | "created_at";
  sortDir: "asc" | "desc";
  page: number;
  pageSize: number;
};

export type PatientGridInitialData = {
  rows: PatientRow[];
  total: number;
  filters: FilterState;
  authToken: string;
  hospitalOptions: string[];
  hospitalChoices: HospitalOption[];
  areaOptions: string[];
  vehicleOptions: string[];
  alcoholOptions: string[];
};

function getRealtimeMode() {
  if (PATIENT_REALTIME_MODE === "sse" || PATIENT_REALTIME_MODE === "poll") {
    return PATIENT_REALTIME_MODE;
  }

  return process.env.NODE_ENV === "production" ? "poll" : "sse";
}

function getSafeInterval(value: number, fallback: number) {
  return Number.isFinite(value) && value >= 1000 ? value : fallback;
}

function normalizePage(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildQueryString(state: FilterState) {
  const params = new URLSearchParams();

  if (state.hospital.trim()) params.set("hospital", state.hospital.trim());
  if (state.name.trim()) params.set("name", state.name.trim());
  if (state.hn.trim()) params.set("hn", state.hn.trim());
  if (state.area.trim()) params.set("area", state.area.trim());
  if (state.vehicle.trim()) params.set("vehicle", state.vehicle.trim());
  if (state.alcohol.trim()) params.set("alcohol", state.alcohol.trim());
  if (state.sex) params.set("sex", state.sex);
  params.set("sortBy", state.sortBy);
  params.set("sortDir", state.sortDir);

  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  return params.toString();
}

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function sanitizeAgeInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 3);
}

function createInitialPatientDraft(): PatientCreateDraft {
  const now = new Date();
  return {
    hoscode: "",
    hosname: "",
    hn: "",
    cid: "",
    patient_name: "",
    visit_date: now.toISOString().split("T")[0] ?? "",
    visit_time: `${padTimePart(now.getHours())}:${padTimePart(now.getMinutes())}`,
    sex: "",
    age: "",
    triage: "",
    status: "",
    cc: "",
  };
}

function stateFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): FilterState {
  const pageSize = PAGE_OPTIONS.includes(normalizePage(searchParams.get("pageSize"), 20))
    ? normalizePage(searchParams.get("pageSize"), 20)
    : 20;

  return {
    hospital: searchParams.get("hospital") ?? "",
    name: searchParams.get("name") ?? "",
    hn: searchParams.get("hn") ?? "",
    area: searchParams.get("area") ?? "",
    vehicle: searchParams.get("vehicle") ?? "",
    alcohol: searchParams.get("alcohol") ?? "",
    sex: searchParams.get("sex") ?? "",
    sortBy:
      searchParams.get("sortBy") === "visit_date_time"
        ? "visit_date_time"
        : searchParams.get("sortBy") === "age"
          ? "age"
          : searchParams.get("sortBy") === "created_at"
            ? "created_at"
          : "visit_date_time",
    sortDir: searchParams.get("sortDir") === "asc" ? "asc" : "desc",
    page: normalizePage(searchParams.get("page"), 1),
    pageSize,
  };
}

function toDateString(input: string | Date | null) {
  if (!input) return "";
  if (input instanceof Date) return input.toISOString().split("T")[0] ?? "";
  return input;
}

function formatDate(input: string | Date | null) {
  if (!input) return "-";

  const rawDate = toDateString(input);
  if (!rawDate) return "-";

  const datePart = rawDate.includes("T") ? rawDate.split("T")[0] : rawDate;
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return rawDate;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const monthLabels = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const monthLabel = monthLabels[month - 1];

  if (!monthLabel || !Number.isFinite(year) || !Number.isFinite(day)) return "-";

  return `${String(day).padStart(2, "0")} ${monthLabel} ${String((year + 543) % 100).padStart(2, "0")}`;
}

function formatTime(input: string | Date | null) {
  if (!input) return "-";
  const rawTime = input instanceof Date ? input.toISOString().split("T")[1] ?? "" : input;
  if (!rawTime) return "-";
  const match = rawTime.match(/^(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]} น.`;
  return "-";
}

function formatSentAt(input: string | null) {
  if (!input) return "-";
  const normalized = input.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return input;
  }

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const shortYear = String((parsed.getFullYear() + 543) % 100).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${shortYear} ${hours}:${minutes}`;
}

function toDateInputValue(input: string | null | undefined) {
  if (!input) return "";
  const raw = input.split("T")[0] ?? input;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function toTimeInputValue(input: string | null | undefined) {
  if (!input) return "";
  const match = input.match(/^(\d{2}):(\d{2})/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
}

async function fetchThaiAddressOptions(query: string, signal?: AbortSignal) {
  const response = await fetch(`/api/thai-address?${query}`, { signal });
  const payload = (await response.json().catch(() => ({}))) as {
    rows?: ThaiAddressOption[];
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load address options");
  }

  return payload.rows ?? [];
}

async function fetchThaiAddressDefaultSelection(signal?: AbortSignal) {
  const response = await fetch("/api/thai-address/defaults", { signal });
  const payload = (await response.json().catch(() => ({}))) as {
    row?: ThaiAddressDefaultSelection | null;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load default address");
  }

  return payload.row ?? null;
}

function normalizeAddressField(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function expandSavedLocationCode(
  value: string | null | undefined,
  part: "province" | "district" | "subdistrict",
  provinceCode = "",
  districtCode = "",
) {
  const digits = normalizeAddressField(value).replace(/\D/g, "");
  if (!digits) return "";

  if (part === "province") {
    return digits.length >= 2 ? digits.slice(0, 2) : digits;
  }

  if (part === "district") {
    if (digits.length >= 4) return digits.slice(0, 4);
    if (digits.length === 2 && provinceCode) return `${provinceCode}${digits}`;
    return "";
  }

  if (digits.length >= 6) return digits.slice(0, 6);
  if (digits.length === 2 && districtCode) return `${districtCode}${digits}`;
  return "";
}

function optionLabel(option: ThaiAddressOption | null) {
  if (!option) return "-";
  return option.name || "-";
}

function formatDx(value: { code?: string; name?: string } | null) {
  if (!value?.code) return "";
  return value.name ? `${value.code} - ${value.name}` : value.code;
}

function formatAcdOptionLabel(option: AcdOption) {
  return `${option.code}-${option.name}`;
}

function formatHospitalName(value: string | null) {
  if (!value) return "-";
  return value.replace(/^โรงพยาบาล\s*/u, "รพ.");
}

function renderSexDisplay(sex: string | null) {
  if (sex === "ชาย") return <span title="ชาย" aria-label="ชาย">ช</span>;
  if (sex === "หญิง") return <span title="หญิง" aria-label="หญิง">ญ</span>;
  return <span>-</span>;
}

function getShiftTextClass(shiftName: string | null) {
  if (shiftName === "เวรเช้า") return "text-amber-600";
  if (shiftName === "เวรบ่าย") return "text-orange-600";
  if (shiftName === "เวรดึก") return "text-indigo-600";
  return "text-slate-500";
}

function isManualSource(source: string | null | undefined) {
  return source === "man";
}

function buildPatientApiUrl(path: string, authToken: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set("token", authToken);
  return `${url.pathname}${url.search}`;
}

function createPatientApiHeaders(authToken: string, headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  nextHeaders.set("Authorization", `Bearer ${authToken}`);
  return nextHeaders;
}

async function fetchPatientGridWithAuth(
  filters: FilterState,
  authToken: string,
  signal?: AbortSignal,
) {
  const response = await fetch(`/api/patient?${buildQueryString(filters)}`, {
    signal,
    headers: createPatientApiHeaders(authToken),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<GridResponse> & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load patient data");
  }

  return {
    rows: payload.rows ?? [],
    total: payload.total ?? 0,
  };
}

function VerticalHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th className={`relative h-20 align-bottom text-center ${className}`}>
      <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 -rotate-45 whitespace-nowrap text-[9px] leading-none">
        {children}
      </div>
    </th>
  );
}

function SortableAngledHeader({
  children,
  className = "",
  onClick,
  title,
}: {
  children: ReactNode;
  className?: string;
  onClick: () => void;
  title: string;
}) {
  return (
    <th className={`relative h-20 align-bottom text-center ${className}`}>
      <button
        type="button"
        className="absolute bottom-10 left-1/2 inline-flex -translate-x-1/2 -rotate-45 cursor-pointer items-center gap-1 whitespace-nowrap text-[9px] leading-none text-sky-900"
        onClick={onClick}
        title={title}
      >
        {children}
        <ArrowDownUp size={10} className="shrink-0" />
      </button>
    </th>
  );
}

function getAcdOption(options: AcdOption[], code: string) {
  return options.find((option) => String(option.code) === code) ?? null;
}

function emptyDetailDraft() {
  return Object.fromEntries(
    ACD_GROUPS.map((group) => [group.name, { code: "", addon_value: "" }]),
  ) as Record<AcdGroupName, PatientDetailDraftItem>;
}

function emptyAcdOptions() {
  const result = {} as Record<AcdGroupName, AcdOption[]>;
  for (const group of ACD_GROUPS) {
    result[group.name] = [];
  }
  return result;
}

type PatientDataGridProps = {
  initialData: PatientGridInitialData;
};

export function PatientDataGrid({ initialData }: PatientDataGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const realtimeMode = useMemo(() => getRealtimeMode(), []);
  const pollIntervalMs = useMemo(() => getSafeInterval(PATIENT_POLL_INTERVAL_MS, 30000), []);
  const streamRetryMs = useMemo(() => getSafeInterval(PATIENT_STREAM_RETRY_MS, 5000), []);

  const [rows, setRows] = useState<PatientRow[]>(() => initialData.rows);
  const [total, setTotal] = useState(() => initialData.total);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(() => initialData.filters);
  const [selectedRow, setSelectedRow] = useState<PatientRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalMode, setCreateModalMode] = useState<"create" | "edit">("create");
  const [editingPatientId, setEditingPatientId] = useState<number | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailRow, setSelectedDetailRow] = useState<PatientRow | null>(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState<PatientRow | null>(null);
  const [draft, setDraft] = useState<PatientEditDraft>(EMPTY_DRAFT);
  const [createDraft, setCreateDraft] = useState<PatientCreateDraft>(() => createInitialPatientDraft());
  const [createSaving, setCreateSaving] = useState(false);
  const [createHospitalQuery, setCreateHospitalQuery] = useState("");
  const [isHospitalSuggestOpen, setIsHospitalSuggestOpen] = useState(false);
  const deferredHospitalQuery = useDeferredValue(createHospitalQuery);
  const [provinceOptions, setProvinceOptions] = useState<ThaiAddressOption[]>([]);
  const [amphoeOptions, setAmphoeOptions] = useState<ThaiAddressOption[]>([]);
  const [tambonOptions, setTambonOptions] = useState<ThaiAddressOption[]>([]);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState(DEFAULT_PROVINCE_CODE);
  const [selectedAmphoeCode, setSelectedAmphoeCode] = useState("");
  const [selectedTambonCode, setSelectedTambonCode] = useState("");
  const [districtLoading, setDistrictLoading] = useState(false);
  const [subdistrictLoading, setSubdistrictLoading] = useState(false);
  const [detailDraft, setDetailDraft] = useState<Record<AcdGroupName, PatientDetailDraftItem>>(
    () => emptyDetailDraft(),
  );
  const [acdOptions, setAcdOptions] = useState<Record<AcdGroupName, AcdOption[]>>(() => emptyAcdOptions());
  const [acdOptionsLoaded, setAcdOptionsLoaded] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const addonInputRefs = useRef<Partial<Record<AcdGroupName, HTMLInputElement | null>>>({});
  const hospitalSuggestRef = useRef<HTMLLabelElement | null>(null);
  const hospitalOptions = initialData.hospitalOptions;
  const hospitalChoices = initialData.hospitalChoices;
  const areaOptions = initialData.areaOptions;
  const vehicleOptions = initialData.vehicleOptions;
  const alcoholOptions = initialData.alcoholOptions;
  const authToken = initialData.authToken;

  useEffect(() => {
    setFilters(stateFromSearchParams(searchParams));
  }, [searchParamsString]);

  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEdit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!isCreateModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelCreate();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isCreateModalOpen]);

  useEffect(() => {
    if (!isCreateModalOpen || createModalMode === "edit") {
      setIsHospitalSuggestOpen(false);
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (hospitalSuggestRef.current?.contains(target)) return;
      setIsHospitalSuggestOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [createModalMode, isCreateModalOpen]);

  useEffect(() => {
    if (!isDetailModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetailModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isDetailModalOpen]);

  useEffect(() => {
    if (acdOptionsLoaded) return;

    const controller = new AbortController();

    fetch("/api/acd-options", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Failed to load acd options");
        }

        return response.json() as Promise<{ rows?: AcdOption[] }>;
      })
      .then((payload) => {
        const grouped = emptyAcdOptions();

        for (const row of payload.rows ?? []) {
          const list = grouped[row.acd_name as AcdGroupName];
          if (list) list.push(row);
        }

        setAcdOptions(grouped);
        setAcdOptionsLoaded(true);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Load acd options failed");
      });

    return () => controller.abort();
  }, [acdOptionsLoaded]);

  useEffect(() => {
    if (!isModalOpen || !selectedRow) return;

    const controller = new AbortController();

    fetch(`/api/patient/${selectedRow.id}/location`, {
      signal: controller.signal,
      headers: createPatientApiHeaders(authToken),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Failed to load location");
        }
        return response.json() as Promise<{
          row: {
            prov_code?: string | null;
            amp_code?: string | null;
            tmb_code?: string | null;
            moo?: string | null;
            road?: string | null;
            detail?: string | null;
          } | null;
        }>;
      })
      .then((payload) => {
        const locationRow = payload.row;
        if (!locationRow) {
          return fetchThaiAddressDefaultSelection(controller.signal).then((defaultRow) => {
            if (!defaultRow) return;

            setSelectedProvinceCode(String(defaultRow.province_code));
            setSelectedAmphoeCode("");
            setSelectedTambonCode("");
            setDraft((current) => ({
              ...current,
              amphoe: "",
              tumbon: "",
            }));
          });
        }

        const provinceCode = expandSavedLocationCode(locationRow.prov_code, "province");
        const amphoeCode = expandSavedLocationCode(locationRow.amp_code, "district", provinceCode);
        const tambonCode = expandSavedLocationCode(
          locationRow.tmb_code,
          "subdistrict",
          provinceCode,
          amphoeCode,
        );

        setSelectedProvinceCode(provinceCode || DEFAULT_PROVINCE_CODE);
        setSelectedAmphoeCode(amphoeCode);
        setSelectedTambonCode(tambonCode);
        setDraft((current) => ({
          ...current,
          moo: "",
          road: locationRow.road ?? "",
          cc: locationRow.detail ?? "",
        }));
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Load location failed");
      });

    return () => controller.abort();
  }, [authToken, isModalOpen, selectedRow]);

  useEffect(() => {
    if (!isDetailModalOpen || !selectedDetailRow) return;

    const controller = new AbortController();
    setDetailLoading(true);

    fetch(`/api/patient/${selectedDetailRow.id}/detail`, {
      signal: controller.signal,
      headers: createPatientApiHeaders(authToken),
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Failed to load patient detail");
        }

        return response.json() as Promise<{ row?: PatientDetailRow | null }>;
      })
      .then((payload) => {
        const row = payload.row;
        const nextDraft = emptyDetailDraft();

        for (const group of ACD_GROUPS) {
          const code = row?.[group.name as keyof PatientDetailRow];
          const addonKey = `${group.name}_addon` as keyof PatientDetailRow;
          const addonValue = row?.[addonKey];

          nextDraft[group.name] = {
            code: code === null || code === undefined ? "" : String(code),
            addon_value: typeof addonValue === "string" ? addonValue : "",
          };
        }

        setDetailDraft(nextDraft);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Load patient detail failed");
      })
      .finally(() => setDetailLoading(false));

    return () => controller.abort();
  }, [authToken, isDetailModalOpen, selectedDetailRow]);

  useEffect(() => {
    if (provinceOptions.length > 0) return;

    const controller = new AbortController();

    fetchThaiAddressOptions("level=province", controller.signal)
      .then((rows) => {
        setProvinceOptions(rows);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Load address failed");
      });

    return () => controller.abort();
  }, [provinceOptions.length]);

  useEffect(() => {
    if (!isModalOpen || !selectedProvinceCode || provinceOptions.length === 0) {
      setAmphoeOptions([]);
      setSelectedAmphoeCode("");
      setTambonOptions([]);
      setSelectedTambonCode("");
      return;
    }

    const selectedProvince = provinceOptions.find((option) => String(option.code) === selectedProvinceCode);
    if (!selectedProvince) return;

    const controller = new AbortController();
    setDistrictLoading(true);

    fetchThaiAddressOptions(`level=district&province_id=${selectedProvince.id}`, controller.signal)
      .then((rows) => {
        const sortedRows = [...rows].sort((a, b) => a.name.localeCompare(b.name, "th"));
        setAmphoeOptions(sortedRows);
        const hasSelectedAmphoe = sortedRows.some((option) => String(option.code) === selectedAmphoeCode);
        if (!hasSelectedAmphoe) {
          setSelectedAmphoeCode("");
          setSelectedTambonCode("");
          setTambonOptions([]);
          setDraft((current) => ({
            ...current,
            amphoe: "",
            tumbon: "",
          }));
        }
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Load address failed");
      })
      .finally(() => setDistrictLoading(false));

    return () => controller.abort();
  }, [isModalOpen, provinceOptions, selectedProvinceCode, selectedAmphoeCode]);

  useEffect(() => {
    if (!isModalOpen || !selectedProvinceCode || !selectedAmphoeCode || amphoeOptions.length === 0) {
      setTambonOptions([]);
      return;
    }

    const selectedAmphoe = amphoeOptions.find((option) => String(option.code) === selectedAmphoeCode);
    if (!selectedAmphoe) return;

    const controller = new AbortController();
    setSubdistrictLoading(true);

    fetchThaiAddressOptions(`level=subdistrict&district_id=${selectedAmphoe.id}`, controller.signal)
      .then((rows) => {
        const sortedRows = [...rows].sort((a, b) => a.name.localeCompare(b.name, "th"));
        setTambonOptions(sortedRows);
        const hasSelectedTambon = sortedRows.some((option) => String(option.code) === selectedTambonCode);
        if (!hasSelectedTambon) {
          setSelectedTambonCode("");
          setDraft((current) => ({
            ...current,
            tumbon: "",
          }));
        }
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Load address failed");
      })
      .finally(() => setSubdistrictLoading(false));

    return () => controller.abort();
  }, [amphoeOptions, isModalOpen, selectedAmphoeCode, selectedProvinceCode, selectedTambonCode]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchPatientGridWithAuth(filters, authToken, controller.signal)
      .then((payload) => {
        setRows(payload.rows);
        setTotal(payload.total);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Load failed");
      })
      .finally(() => setLoading(false));

    const queryString = buildQueryString(filters);
    if (queryString !== searchParams.toString()) {
      router.replace(`${pathname}?${queryString}`, { scroll: false });
    }

    return () => controller.abort();
  }, [authToken, filters, pathname, router, searchParamsString]);

  const totalPages = useMemo(
    () => (total > 0 ? Math.max(1, Math.ceil(total / filters.pageSize)) : 1),
    [filters.pageSize, total],
  );

  const refreshRows = async () => {
    try {
      const payload = await fetchPatientGridWithAuth(filters, authToken);
      setRows(payload.rows);
      setTotal(payload.total);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Refresh failed");
    }
  };

  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const refreshForRealtime = async () => {
      try {
        const payload = await fetchPatientGridWithAuth(filters, authToken);
        if (!active) return;
        setRows(payload.rows);
        setTotal(payload.total);
      } catch (fetchError) {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : "Realtime refresh failed");
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(() => {
        void refreshForRealtime();
      }, pollIntervalMs);
    };

    const stopPolling = () => {
      if (!pollTimer) return;
      clearInterval(pollTimer);
      pollTimer = null;
    };

    const scheduleReconnect = () => {
      if (reconnectTimer || !active) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startStreaming();
      }, streamRetryMs);
    };

    const startStreaming = () => {
      if (!active) return;

      if (realtimeMode !== "sse") {
        startPolling();
        return;
      }

      stopPolling();
      eventSource?.close();
      eventSource = new EventSource(
        buildPatientApiUrl(`/api/patient/stream?${buildQueryString(filters)}`, authToken),
      );

      eventSource.addEventListener("message", () => {
        void refreshForRealtime();
      });

      eventSource.addEventListener("ready", () => {
        stopPolling();
      });

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        startPolling();
        scheduleReconnect();
      };
    };

    startStreaming();

    return () => {
      active = false;
      eventSource?.close();
      stopPolling();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [authToken, filters, pollIntervalMs, realtimeMode, streamRetryMs]);

  const provinceLabel = useMemo(() => {
    const selectedProvince = provinceOptions.find((option) => String(option.code) === selectedProvinceCode);
    return selectedProvince?.name ?? DEFAULT_PROVINCE_NAME;
  }, [provinceOptions, selectedProvinceCode]);

  const filteredHospitalChoices = useMemo(() => {
    const query = deferredHospitalQuery.trim().toLowerCase();
    if (!query) return hospitalChoices.slice(0, 8);

    return hospitalChoices
      .filter((option) => {
        const name = option.hosname.toLowerCase();
        const code = option.hoscode?.toLowerCase() ?? "";
        return name.includes(query) || code.includes(query);
      })
      .slice(0, 8);
  }, [deferredHospitalQuery, hospitalChoices]);

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
  };

  const toggleVisitDateSort = () => {
    updateFilter({
      sortBy: "visit_date",
      sortDir: filters.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    });
  };

  const toggleAgeSort = () => {
    updateFilter({
      sortBy: "age",
      sortDir: filters.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    });
  };

  const toggleCreatedAtSort = () => {
    updateFilter({
      sortBy: "created_at",
      sortDir: filters.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    });
  };

  const startEdit = (row: PatientRow) => {
    setError(null);
    setSelectedRow(row);
    setDraft({
      changwat: DEFAULT_PROVINCE_NAME,
      amphoe: row.amphoe ?? "",
      tumbon: row.tumbon ?? "",
      moo: "",
      road: row.road ?? "",
      cc: row.cc ?? "",
    });
    setSelectedProvinceCode(DEFAULT_PROVINCE_CODE);
    setSelectedAmphoeCode("");
    setSelectedTambonCode("");
    setAmphoeOptions([]);
    setTambonOptions([]);
    setIsModalOpen(true);
  };

  const cancelEdit = () => {
    setError(null);
    setSaving(false);
    setIsModalOpen(false);
    setSelectedRow(null);
    setDraft(EMPTY_DRAFT);
    setSelectedProvinceCode(DEFAULT_PROVINCE_CODE);
    setSelectedAmphoeCode("");
    setSelectedTambonCode("");
    setAmphoeOptions([]);
    setTambonOptions([]);
  };

  const openCreateModal = () => {
    const nextDraft = createInitialPatientDraft();
    setError(null);
    setCreateDraft(nextDraft);
    setCreateHospitalQuery("");
    setIsHospitalSuggestOpen(false);
    setCreateSaving(false);
    setCreateModalMode("create");
    setEditingPatientId(null);
    setIsCreateModalOpen(true);
  };

  const openUpdatePatientModal = (row: PatientRow) => {
    setError(null);
    setCreateDraft({
      hoscode: row.hoscode ?? "",
      hosname: row.hosname ?? "",
      hn: row.hn ?? "",
      cid: row.cid ?? "",
      patient_name: row.patient_name ?? "",
      visit_date: toDateInputValue(row.visit_date),
      visit_time: toTimeInputValue(row.visit_time),
      sex: row.sex ?? "",
      age: row.age === null || row.age === undefined ? "" : sanitizeAgeInput(String(row.age)),
      triage: row.triage ?? "",
      status: row.status ?? "",
      cc: row.cc ?? "",
    });
    setCreateHospitalQuery(row.hosname ?? "");
    setIsHospitalSuggestOpen(false);
    setCreateSaving(false);
    setCreateModalMode("edit");
    setEditingPatientId(row.id);
    setIsCreateModalOpen(true);
  };

  const cancelCreate = () => {
    setError(null);
    setIsCreateModalOpen(false);
    setCreateDraft(createInitialPatientDraft());
    setCreateHospitalQuery("");
    setIsHospitalSuggestOpen(false);
    setCreateSaving(false);
    setCreateModalMode("create");
    setEditingPatientId(null);
    setIsDeleteConfirmOpen(false);
    setPendingDeleteRow(null);
  };

  const updateCreateDraft = (patch: Partial<PatientCreateDraft>) => {
    setCreateDraft((current) => ({
      ...current,
      ...patch,
    }));
  };

  const selectHospitalChoice = (option: HospitalOption) => {
    setCreateHospitalQuery(option.hosname);
    setIsHospitalSuggestOpen(false);
    updateCreateDraft({
      hoscode: option.hoscode ?? "",
      hosname: option.hosname,
    });
  };

  const openDetailModal = (row: PatientRow) => {
    setError(null);
    setSelectedDetailRow(row);
    setDetailDraft(emptyDetailDraft());
    setIsDetailModalOpen(true);
  };

  const performDeletePatientRow = async (row: PatientRow) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/patient/${row.id}`, {
        method: "DELETE",
        headers: createPatientApiHeaders(authToken),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to delete patient");
      }

      await refreshRows();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const deletePatientRow = async (row: PatientRow) => {
    const confirmed = window.confirm(`ต้องการลบ ${row.patient_name ?? "-"} ใช่หรือไม่?`);
    if (!confirmed) return;
    await performDeletePatientRow(row);
  };

  const requestDeleteCurrentPatient = () => {
    if (!editingPatientId) return;
    setPendingDeleteRow(rows.find((row) => row.id === editingPatientId) ?? selectedRow ?? null);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteCurrentPatient = async () => {
    if (!pendingDeleteRow) return;

    setIsDeleteConfirmOpen(false);
    await performDeletePatientRow(pendingDeleteRow);
    cancelCreate();
  };

  const closeDetailModal = () => {
    setError(null);
    setIsDetailModalOpen(false);
    setSelectedDetailRow(null);
    setDetailDraft(emptyDetailDraft());
    setDetailLoading(false);
    setDetailSaving(false);
  };

  const saveEdit = async () => {
    if (!selectedRow) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/patient/${selectedRow.id}/location`, {
        method: "PUT",
        headers: createPatientApiHeaders(authToken, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          prov_code: selectedProvinceCode,
          amp_code: selectedAmphoeCode,
          tmb_code: selectedTambonCode,
          moo: draft.moo,
          road: draft.road,
          detail: draft.cc,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to save location");
      cancelEdit();
      void refreshRows();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveCreate = async () => {
    setError(null);

    if (!createDraft.cid.trim()) {
      setError("กรุณากรอก CID");
      return;
    }

    if (!createDraft.patient_name.trim()) {
      setError("กรุณากรอกชื่อผู้ป่วย");
      return;
    }

    if (!createDraft.sex.trim()) {
      setError("กรุณาเลือกเพศ");
      return;
    }

    const parsedAge = Number.parseInt(createDraft.age, 10);
    if (!createDraft.age.trim() || !Number.isFinite(parsedAge) || parsedAge < 0) {
      setError("กรุณากรอกอายุให้ถูกต้อง");
      return;
    }

    if (!createDraft.triage.trim()) {
      setError("กรุณาเลือก Triage");
      return;
    }

    if (!createDraft.cc.trim()) {
      setError("กรุณากรอกอาการสำคัญ");
      return;
    }

    setCreateSaving(true);

    try {
      const body = {
        hoscode: createDraft.hoscode.trim(),
        hosname: createDraft.hosname.trim(),
        hn: createDraft.hn.trim(),
        cid: createDraft.cid.trim(),
        patient_name: createDraft.patient_name.trim(),
        visit_date: createDraft.visit_date,
        visit_time: createDraft.visit_time,
        sex: createDraft.sex,
        age: parsedAge,
        triage: createDraft.triage,
        status: createDraft.status,
        cc: createDraft.cc.trim(),
      };

      const response = await fetch(
        createModalMode === "edit" && editingPatientId
          ? `/api/patient/${editingPatientId}`
          : "/api/patient",
        {
          method: createModalMode === "edit" && editingPatientId ? "PATCH" : "POST",
          headers: createPatientApiHeaders(authToken, { "Content-Type": "application/json" }),
          body: JSON.stringify(body),
        },
      );

      const payload = (await response.json().catch(() => ({}))) as CreatePatientResponse;
      if (!response.ok) {
        throw new Error(payload.message ?? "Failed to create patient");
      }

      cancelCreate();
      updateFilter({ page: 1 });
      void refreshRows();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Create patient failed");
    } finally {
      setCreateSaving(false);
    }
  };

  const updateDetailDraft = (group: AcdGroupName, patch: Partial<PatientDetailDraftItem>) => {
    setDetailDraft((current) => ({
      ...current,
      [group]: {
        ...current[group],
        ...patch,
      },
    }));
  };

  const saveDetail = async () => {
    if (!selectedDetailRow) return;

    setDetailSaving(true);
    setError(null);

    try {
      const body = Object.fromEntries(
        ACD_GROUPS.flatMap((group) => [
          [group.name, detailDraft[group.name].code],
          [`${group.name}_addon`, detailDraft[group.name].addon_value],
        ]),
      );

      const response = await fetch(`/api/patient/${selectedDetailRow.id}/detail`, {
        method: "PUT",
        headers: createPatientApiHeaders(authToken, { "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to save patient detail");
      closeDetailModal();
      void refreshRows();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save detail failed");
    } finally {
      setDetailSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-8 lg:px-10">
      <div className="border border-sky-200 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-4">
          <h1 className="whitespace-nowrap text-[1.5rem] font-semibold text-slate-900">
            แบบรายงานชื่อผู้ได้รับบาดเจ็บและเสียชีวิตจากอุบัติเหตุทางถนน
          </h1>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[12px] font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900"
          >
            กลับ Dashboard
          </Link>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <select
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={filters.hospital}
            onChange={(event) => {
              updateFilter({ hospital: event.target.value, page: 1 });
            }}
          >
            <option value="">ทุก รพ.</option>
            {hospitalOptions.map((hospital, index) => (
              <option key={`${hospital}-${index}`} value={hospital}>
                {formatHospitalName(hospital)}
              </option>
            ))}
          </select>
          <input
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="กรอง ชื่อ-นามสกุล"
            value={filters.name}
            onChange={(event) => {
              updateFilter({ name: event.target.value, page: 1 });
            }}
          />
          <select
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={filters.area}
            onChange={(event) => {
              updateFilter({ area: event.target.value, page: 1 });
            }}
          >
            <option value="">ทุกพื้นที่</option>
            {areaOptions.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          <select
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={filters.vehicle}
            onChange={(event) => {
              updateFilter({ vehicle: event.target.value, page: 1 });
            }}
          >
            <option value="">ประเภทรถ</option>
            {vehicleOptions.map((vehicle) => (
              <option key={vehicle} value={vehicle}>
                {vehicle}
              </option>
            ))}
          </select>
          <select
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={filters.alcohol}
            onChange={(event) => {
              updateFilter({ alcohol: event.target.value, page: 1 });
            }}
          >
            <option value="">การดื่มสุรา</option>
            {alcoholOptions.map((alcohol) => (
              <option key={alcohol} value={alcohol}>
                {alcohol}
              </option>
            ))}
          </select>
          <select
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            value={filters.sex}
            onChange={(event) => {
              updateFilter({ sex: event.target.value, page: 1 });
            }}
          >
            <option value="">ทุกเพศ</option>
            <option value="ชาย">ชาย</option>
            <option value="หญิง">หญิง</option>
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-slate-600">
          <div>
            {loading ? "Loading..." : `Total ${total.toLocaleString()} rows`}
            {error ? <span className="ml-3 text-rose-600">{error}</span> : null}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span>Rows:</span>
              <select
                className="h-8 border border-sky-200 bg-white px-2 text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                value={filters.pageSize}
                onChange={(event) => {
                  updateFilter({ pageSize: Number(event.target.value), page: 1 });
                }}
              >
                {PAGE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="h-8 border border-sky-200 bg-white px-3 text-slate-700 disabled:opacity-40"
              onClick={() => updateFilter({ page: Math.max(1, filters.page - 1) })}
              disabled={filters.page <= 1 || loading}
            >
              Prev
            </button>
            <span>
              Page {filters.page} / {totalPages}
            </span>
            <button
              type="button"
              className="h-8 border border-sky-200 bg-white px-3 text-slate-700 disabled:opacity-40"
              onClick={() => updateFilter({ page: Math.min(totalPages, filters.page + 1) })}
              disabled={filters.page >= totalPages || loading}
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-3 flex justify-start">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 border border-sky-400 bg-sky-600 px-4 text-[12px] font-medium text-white transition hover:bg-sky-700"
            onClick={openCreateModal}
          >
            <Plus size={15} />
            เพิ่ม
          </button>
        </div>

        <div className="mt-5 border border-sky-200">
          <table className="w-full table-fixed border-collapse">
            <thead className="bg-sky-50 text-left text-xs uppercase tracking-[0.16em] text-sky-900">
              <tr>
                <VerticalHeader className="w-[42px] px-2 py-3">#</VerticalHeader>
                <SortableAngledHeader
                  className="w-[80px] px-2 py-3"
                  onClick={toggleVisitDateSort}
                  title={`Sort วันที่มา ${filters.sortDir === "asc" ? "descending" : "ascending"}`}
                >
                  วันที่มา
                </SortableAngledHeader>
                <VerticalHeader className="w-[140px] px-2 py-3">รพ.</VerticalHeader>
                <VerticalHeader className="w-[150px] px-2 py-3">ชื่อ-นามสกุล</VerticalHeader>
                <VerticalHeader className="w-[48px] px-2 py-3">เพศ</VerticalHeader>
                <SortableAngledHeader
                  className="w-[48px] px-2 py-3"
                  onClick={toggleAgeSort}
                  title={`Sort อายุ ${filters.sortDir === "asc" ? "descending" : "ascending"}`}
                >
                  อายุ
                </SortableAngledHeader>
                <VerticalHeader className="w-[72px] px-2 py-3">Triage</VerticalHeader>
                <VerticalHeader className="w-[140px] px-2 py-3">อาการสำคัญ</VerticalHeader>
                <VerticalHeader className="w-[170px] px-2 py-3">PDX</VerticalHeader>
                <VerticalHeader className="w-[85px] px-2 py-3">พื้นที่</VerticalHeader>
                <VerticalHeader className="w-[85px] px-2 py-3">รถ</VerticalHeader>
                <VerticalHeader className="w-[85px] px-2 py-3">สุรา</VerticalHeader>
                <SortableAngledHeader
                  className="w-[110px] px-2 py-3"
                  onClick={toggleCreatedAtSort}
                  title={`Sort วันที่ส่งข้อมูล ${filters.sortDir === "asc" ? "descending" : "ascending"}`}
                >
                  วันที่ส่งข้อมูล
                </SortableAngledHeader>
                <VerticalHeader className="w-[52px] px-2 py-3">จุดเกิดเหตุ</VerticalHeader>
                <VerticalHeader className="w-[52px] px-2 py-3">เพิ่มเติม</VerticalHeader>
                <VerticalHeader className="w-[72px] px-2 py-3">Action</VerticalHeader>
              </tr>
            </thead>
            <tbody className="text-[12px] text-slate-700">
              {rows.map((row, index) => {
                const displayNo = total - ((filters.page - 1) * filters.pageSize) - index;
                return (
                  <tr
                    key={row.id}
                    className="border-t border-sky-100 align-top odd:bg-white even:bg-sky-50/50"
                  >
                    <td className="px-2 py-3">{displayNo}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600">
                      <span className="block">{formatDate(row.visit_date)}</span>
                      <span className="block text-[11px] text-slate-400">{formatTime(row.visit_time)}</span>
                      <span className={`block text-[11px] ${getShiftTextClass(row.shift_name)}`}>{row.shift_name ?? "-"}</span>
                    </td>
                    <td className="break-words px-2 py-3">{formatHospitalName(row.hosname)}</td>
                    <td className="break-words px-2 py-3">{row.patient_name ?? "-"}</td>
                    <td className="px-2 py-3">{renderSexDisplay(row.sex)}</td>
                    <td className="px-2 py-3">{row.age ?? "-"}</td>
                    <td className="px-2 py-3">{row.triage ?? "-"}</td>
                    <td className="break-words px-2 py-3 text-[10px]">{row.cc ?? "-"}</td>
                    <td className="break-words px-2 py-3 text-[10px]">{formatDx(row.pdx)}</td>
                    <td className="break-words px-2 py-3">{row.area ?? "-"}</td>
                    <td className="break-words px-2 py-3">{row.vehicle ?? "-"}</td>
                    <td className="break-words px-2 py-3">{row.alcohol ?? "-"}</td>
                    <td className="whitespace-nowrap px-2 py-3 text-[10px] text-slate-600">{formatSentAt(row.created_at)}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                          onClick={() => startEdit(row)}
                          title="บันทึกจุดเกิดเหตุ"
                        >
                          <MapPin size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                          onClick={() => openDetailModal(row)}
                          title="กรอกข้อมูลเพิ่มเติม"
                        >
                          <FileText size={16} />
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          onClick={() => openUpdatePatientModal(row)}
                          title="Update"
                          aria-label="Update"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-5 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cancelCreate();
          }}
        >
          <div
            key={`${createModalMode}-${editingPatientId ?? "new"}`}
            className="flex max-h-[calc(100vh-2.5rem)] w-full max-w-4xl flex-col overflow-hidden border border-sky-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-create-title"
          >
            <div className="border-b border-sky-100 bg-sky-50/50 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="patient-create-title" className="text-[14px] font-semibold text-slate-900">
                    {createModalMode === "edit" ? `Update patient (${editingPatientId ?? "-"})` : "เพิ่ม patient"}
                  </h2>
                  <p className="mt-1 text-[12px] leading-5 text-slate-600">
                    {createModalMode === "edit"
                      ? "แก้ไขข้อมูลผู้ป่วยหลัก แล้วกดบันทึกเพื่ออัปเดต"
                      : "ค้นหา รพ. ก่อน แล้วกรอกข้อมูลผู้ป่วย (บังคับ: CID, ชื่อผู้ป่วย, เพศ, อายุ, Triage, อาการสำคัญ)"}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                  onClick={cancelCreate}
                  aria-label="Close create modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-5">
                <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <label ref={hospitalSuggestRef} className="relative grid min-w-0 gap-2 text-[12px] text-slate-700">
                    <span>รพ.</span>
                    <input
                      className={`h-10 w-full min-w-0 border px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 ${
                        createModalMode === "edit"
                          ? "border-slate-200 bg-slate-50"
                          : "border-sky-200 bg-white"
                      }`}
                      placeholder="พิมพ์ชื่อโรงพยาบาล หรือรหัส รพ."
                      value={createHospitalQuery}
                      readOnly={createModalMode === "edit"}
                      onFocus={() => {
                        if (createModalMode === "create") setIsHospitalSuggestOpen(true);
                      }}
                      onChange={(event) => {
                        if (createModalMode === "edit") return;
                        const nextValue = event.target.value;
                        setCreateHospitalQuery(nextValue);
                        setIsHospitalSuggestOpen(true);
                        updateCreateDraft({
                          hoscode: "",
                          hosname: nextValue.trim(),
                        });
                      }}
                      autoComplete="off"
                    />
                    {isHospitalSuggestOpen ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-56 overflow-y-auto border border-sky-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.12)]">
                        {filteredHospitalChoices.length > 0 ? (
                          filteredHospitalChoices.map((option) => (
                            <button
                              key={`${option.hoscode ?? "unknown"}-${option.hosname}`}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 border-b border-sky-50 px-3 py-2 text-left text-[12px] text-slate-700 transition last:border-b-0 hover:bg-sky-50"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectHospitalChoice(option);
                              }}
                            >
                              <span className="min-w-0 truncate font-medium text-slate-900">{option.hosname}</span>
                              <span className="shrink-0 text-slate-500">{option.hoscode ?? "-"}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-3 text-[12px] text-slate-500">ไม่พบข้อมูล รพ.</div>
                        )}
                      </div>
                    ) : null}
                  </label>
                  <label className="grid min-w-0 gap-2 self-start text-[12px] text-slate-700">
                    <span>รหัส รพ.</span>
                    <input
                      className="h-10 w-full min-w-0 border border-sky-200 bg-slate-50 px-3 text-[12px] font-medium text-slate-900 outline-none"
                      value={createDraft.hoscode}
                      readOnly
                    />
                  </label>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-4">
                      <h3 className="text-[12px] font-semibold text-slate-900">ข้อมูลผู้ป่วย</h3>
                      <p className="mt-1 text-[11px] text-slate-500">กรอกข้อมูลระบุตัวตนของผู้ป่วย</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700">
                        <span>CID <span className="text-rose-600">*</span></span>
                        <input
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          inputMode="numeric"
                          maxLength={13}
                          autoComplete="off"
                          placeholder="เลขประจำตัวประชาชน"
                          value={createDraft.cid}
                          onChange={(event) =>
                            updateCreateDraft({ cid: event.target.value.replace(/\D/g, "").slice(0, 13) })
                          }
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700">
                        <span>HN</span>
                        <input
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          placeholder="เลข HN"
                          autoComplete="off"
                          value={createDraft.hn}
                          onChange={(event) => updateCreateDraft({ hn: event.target.value })}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700 sm:col-span-2">
                        <span>ชื่อผู้ป่วย <span className="text-rose-600">*</span></span>
                        <input
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          placeholder="ชื่อ-นามสกุล"
                          autoComplete="off"
                          value={createDraft.patient_name}
                          onChange={(event) => updateCreateDraft({ patient_name: event.target.value })}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700">
                        <span>เพศ <span className="text-rose-600">*</span></span>
                        <select
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          value={createDraft.sex}
                          onChange={(event) => updateCreateDraft({ sex: event.target.value })}
                        >
                          <option value="">ไม่ระบุ</option>
                          <option value="ชาย">ชาย</option>
                          <option value="หญิง">หญิง</option>
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700">
                        <span>อายุ <span className="text-rose-600">*</span></span>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          placeholder="ปี"
                          value={createDraft.age}
                          onChange={(event) => updateCreateDraft({ age: sanitizeAgeInput(event.target.value) })}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-4">
                      <h3 className="text-[12px] font-semibold text-slate-900">ข้อมูลการมารับบริการ</h3>
                      <p className="mt-1 text-[11px] text-slate-500">วันเวลา และสถานะเบื้องต้น</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700">
                        <span>วันที่มา</span>
                        <input
                          type="date"
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          value={createDraft.visit_date}
                          onChange={(event) => updateCreateDraft({ visit_date: event.target.value })}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700">
                        <span>เวลามา</span>
                        <input
                          type="time"
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          value={createDraft.visit_time}
                          onChange={(event) => updateCreateDraft({ visit_time: event.target.value })}
                        />
                      </label>
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700">
                        <span>Triage <span className="text-rose-600">*</span></span>
                        <select
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          value={createDraft.triage}
                          onChange={(event) => updateCreateDraft({ triage: event.target.value })}
                        >
                          <option value="">ไม่ระบุ</option>
                          {DEFAULT_TRIAGE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700">
                        <span>Status</span>
                        <select
                          className="h-10 w-full min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          value={createDraft.status}
                          onChange={(event) => updateCreateDraft({ status: event.target.value })}
                        >
                          <option value="">ไม่ระบุ</option>
                          {DEFAULT_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-2 text-[12px] text-slate-700 sm:col-span-2">
                        <span>อาการสำคัญ <span className="text-rose-600">*</span></span>
                        <textarea
                          className="min-h-[128px] w-full min-w-0 border border-sky-200 bg-white px-3 py-3 text-[12px] leading-5 text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          placeholder="บันทึกอาการสำคัญหรือหมายเหตุเบื้องต้น"
                          autoComplete="off"
                          value={createDraft.cc}
                          onChange={(event) => updateCreateDraft({ cc: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-sky-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-slate-500">ช่องที่มี <span className="text-rose-600">*</span> จำเป็นต้องกรอก</p>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                {createModalMode === "edit" ? (
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center gap-2 border border-rose-300 bg-rose-50 px-4 text-[12px] font-medium text-rose-700 hover:bg-rose-100"
                    onClick={requestDeleteCurrentPatient}
                    disabled={createSaving}
                  >
                    <Trash2 size={16} />
                    ลบผู้ป่วย
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center border border-sky-200 bg-white px-4 text-[12px] font-medium text-slate-700 hover:bg-sky-50"
                  onClick={cancelCreate}
                  disabled={createSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 border border-sky-400 bg-sky-600 px-4 text-[12px] font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                  onClick={() => void saveCreate()}
                  disabled={createSaving}
                >
                  <Save size={16} />
                  {createSaving
                    ? "Saving..."
                    : createModalMode === "edit"
                      ? "Update Patient"
                      : "บันทึก Patient"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isDeleteConfirmOpen && pendingDeleteRow ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsDeleteConfirmOpen(false);
              setPendingDeleteRow(null);
            }
          }}
        >
          <div
            className="w-full max-w-md border border-rose-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.25)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <div className="border-b border-rose-100 bg-rose-50/50 px-5 py-4">
              <h3 id="delete-confirm-title" className="text-[14px] font-semibold text-slate-900">
                ลบผู้ป่วย
              </h3>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">
                ต้องการลบ <span className="font-medium text-slate-900">{pendingDeleteRow.patient_name ?? "-"}</span> ใช่หรือไม่?
              </p>
            </div>
            <div className="px-5 py-4 text-[12px] text-slate-600">
              ข้อมูลที่ลบจะไม่สามารถกู้คืนได้
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-rose-100 bg-white px-5 py-4">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center border border-slate-200 bg-white px-4 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setIsDeleteConfirmOpen(false);
                  setPendingDeleteRow(null);
                }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 border border-rose-400 bg-rose-600 px-4 text-[12px] font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                onClick={() => void confirmDeleteCurrentPatient()}
                disabled={loading}
              >
                <Trash2 size={16} />
                ลบจริง
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isModalOpen && selectedRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) cancelEdit();
          }}
        >
          <div
            className="w-full max-w-4xl border border-sky-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-edit-title"
          >
            <div className="border-b border-sky-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="patient-edit-title" className="text-[12px] font-semibold text-slate-900">
                    บันทึกสถานที่เกิดเหตุ
                  </h2>
                  <p className="mt-1 text-[12px] text-slate-600">
                    กรอกจังหวัด อำเภอ ตำบล หมู่ที่ ถนน และรายละเอียดจุดเกิดเหตุ
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                  onClick={cancelEdit}
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 grid gap-2 text-[12px] text-slate-600 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">วันที่มา</span>
                  <span className="block whitespace-nowrap font-medium text-slate-900">{formatDate(selectedRow.visit_date)}</span>
                </div>
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">เวลามา</span>
                  <span className="block whitespace-nowrap font-medium text-slate-900">{formatTime(selectedRow.visit_time)}</span>
                </div>
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">เลขบัตร</span>
                  <span className="block font-medium text-slate-900">{selectedRow.cid ?? "-"}</span>
                </div>
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">ชื่อ-นามสกุล</span>
                  <span className="block font-medium text-slate-900">{selectedRow.patient_name ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-[12px] text-slate-700">
                  <span>จังหวัด</span>
                  <input
                    className="h-9 border border-sky-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none"
                    value={provinceLabel}
                    readOnly
                  />
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700">
                  <span>อำเภอ</span>
                  <select
                    className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
                    value={selectedAmphoeCode}
                    onChange={(event) => {
                      const nextAmphoeCode = event.target.value;
                      const matchedAmphoe =
                        amphoeOptions.find((option) => String(option.code) === nextAmphoeCode) ?? null;

                      setSelectedAmphoeCode(nextAmphoeCode);
                      setSelectedTambonCode("");
                      setTambonOptions([]);
                      setDraft((current) => ({
                        ...current,
                        amphoe: matchedAmphoe?.name ?? "",
                        tumbon: "",
                      }));
                    }}
                    disabled={!selectedProvinceCode || (districtLoading && amphoeOptions.length === 0)}
                  >
                    <option value="">
                      {!selectedProvinceCode
                        ? "เลือกจังหวัดก่อน"
                        : districtLoading && amphoeOptions.length === 0
                          ? "Loading..."
                          : "เลือกอำเภอ"}
                    </option>
                    {amphoeOptions.map((option) => (
                      <option key={option.id} value={String(option.code)}>
                        {optionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700 sm:col-span-2">
                  <span>ตำบล</span>
                  <select
                    className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
                    value={selectedTambonCode}
                    onChange={(event) => {
                      const nextTambonCode = event.target.value;
                      const matchedTambon =
                        tambonOptions.find((option) => String(option.code) === nextTambonCode) ?? null;

                      setSelectedTambonCode(nextTambonCode);
                      setDraft((current) => ({
                        ...current,
                        tumbon: matchedTambon?.name ?? "",
                      }));
                    }}
                    disabled={!selectedAmphoeCode || (subdistrictLoading && tambonOptions.length === 0)}
                  >
                    <option value="">
                      {!selectedAmphoeCode
                        ? "เลือกอำเภอก่อน"
                        : subdistrictLoading && tambonOptions.length === 0
                          ? "Loading..."
                          : "เลือกตำบล"}
                    </option>
                    {tambonOptions.map((option) => (
                      <option key={option.id} value={String(option.code)}>
                        {optionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700">
                  <span>หมู่ที่</span>
                  <input
                    className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    inputMode="numeric"
                    placeholder="เช่น 5"
                    value={draft.moo}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, moo: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700">
                  <span>ถนน</span>
                  <input
                    className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    placeholder="กรอกชื่อถนน"
                    value={draft.road}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, road: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700 sm:col-span-2">
                  <span>จุดเกิดเหตุ</span>
                  <input
                    className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    placeholder="กรอกจุดเกิดเหตุ"
                    value={draft.cc}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, cc: event.target.value }))
                    }
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-sky-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center border border-sky-200 bg-white px-4 text-[12px] font-medium text-slate-700 hover:bg-sky-50"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 border border-sky-400 bg-sky-600 px-4 text-[12px] font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                onClick={() => void saveEdit()}
                disabled={saving}
              >
                <Save size={16} />
                {saving ? "Saving..." : "บันทึกสถานที่"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isDetailModalOpen && selectedDetailRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDetailModal();
          }}
        >
          <div
            className="w-full max-w-6xl border border-sky-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-detail-title"
          >
            <div className="border-b border-sky-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="patient-detail-title" className="text-[12px] font-semibold text-slate-900">
                    เพิ่มเติม
                  </h2>
                  <p className="mt-1 text-[12px] text-slate-600">
                    กรอกข้อมูลตามตัวเลือกในตาราง acd_*
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                  onClick={closeDetailModal}
                  aria-label="Close additional modal"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-4 grid gap-2 text-[12px] text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">เลขบัตร</span>
                  <span className="block font-medium text-slate-900">{selectedDetailRow.cid ?? "-"}</span>
                </div>
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">ชื่อ-นามสกุล</span>
                  <span className="block font-medium text-slate-900">{selectedDetailRow.patient_name ?? "-"}</span>
                </div>
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">วันที่มา</span>
                  <span className="block whitespace-nowrap font-medium text-slate-900">{formatDate(selectedDetailRow.visit_date)}</span>
                </div>
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">เวลามา</span>
                  <span className="block whitespace-nowrap font-medium text-slate-900">{formatTime(selectedDetailRow.visit_time)}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {ACD_GROUPS.map((group) => {
                  const current = detailDraft[group.name];
                  const options = acdOptions[group.name] ?? [];
                  const selectedOption = getAcdOption(options, current.code);

                  return (
                    <div key={group.name} className="grid gap-2 border border-sky-100 bg-sky-50/40 p-3">
                      <label className="grid gap-2 text-[12px] text-slate-700">
                        <span>{group.label}</span>
                        <div className="flex flex-nowrap items-center gap-2">
                          <select
                            className={`h-9 min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 ${
                              selectedOption?.is_addon ? "w-1/2" : "flex-1"
                            }`}
                            value={current.code}
                            onChange={(event) => {
                              const nextCode = event.target.value;
                              const nextOption = getAcdOption(options, nextCode);

                            updateDetailDraft(group.name, {
                              code: nextCode,
                              addon_value: nextOption?.is_addon ? current.addon_value : "",
                            });

                            if (nextOption?.is_addon) {
                              requestAnimationFrame(() => {
                                addonInputRefs.current[group.name]?.focus();
                              });
                            }
                          }}
                          disabled={detailLoading || detailSaving}
                        >
                            <option value="">-</option>
                            {options.map((option) => (
                              <option key={`${group.name}-${option.code}`} value={String(option.code)}>
                                {formatAcdOptionLabel(option)}
                              </option>
                            ))}
                          </select>
                          {selectedOption?.is_addon ? (
                            <input
                              ref={(element) => {
                                addonInputRefs.current[group.name] = element;
                              }}
                              className="h-9 w-1/2 min-w-0 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                              placeholder="ระบุ"
                              value={current.addon_value}
                              onChange={(event) =>
                                updateDetailDraft(group.name, { addon_value: event.target.value })
                              }
                              disabled={detailLoading || detailSaving}
                            />
                          ) : null}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-sky-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center border border-sky-200 bg-white px-4 text-[12px] font-medium text-slate-700 hover:bg-sky-50"
                onClick={closeDetailModal}
                disabled={detailSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 border border-sky-400 bg-sky-600 px-4 text-[12px] font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                onClick={() => void saveDetail()}
                disabled={detailLoading || detailSaving}
              >
                <Pencil size={16} />
                {detailSaving ? "Saving..." : "บันทึกเพิ่มเติม"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
