"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Save, SquarePen, X } from "lucide-react";

type PatientRow = {
  id: number;
  hoscode: string | null;
  hosname: string | null;
  hn: string | null;
  patient_name: string | null;
  dateserv: string | null;
  sex: string | null;
  age: number | null;
  status: string | null;
  triage: string | null;
  pdx: { code?: string; name?: string } | null;
  ext_dx: { code?: string; name?: string } | null;
};

type GridResponse = {
  rows: PatientRow[];
  page: number;
  pageSize: number;
  total: number;
};

type PatientEditDraft = {
  hosname: string;
  hn: string;
  patient_name: string;
  sex: string;
  triage: string;
  status: string;
};

const PAGE_OPTIONS = [20, 50, 100];
const EMPTY_DRAFT: PatientEditDraft = {
  hosname: "",
  hn: "",
  patient_name: "",
  sex: "",
  triage: "",
  status: "",
};

type FilterState = {
  hospital: string;
  name: string;
  hn: string;
  sex: string;
  page: number;
  pageSize: number;
};

function normalizePage(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildQueryString(state: FilterState) {
  const params = new URLSearchParams();

  if (state.hospital.trim()) params.set("hospital", state.hospital.trim());
  if (state.name.trim()) params.set("name", state.name.trim());
  if (state.hn.trim()) params.set("hn", state.hn.trim());
  if (state.sex) params.set("sex", state.sex);

  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  return params.toString();
}

function stateFromSearchParams(searchParams: ReturnType<typeof useSearchParams>): FilterState {
  const pageSize = PAGE_OPTIONS.includes(normalizePage(searchParams.get("pageSize"), 20))
    ? normalizePage(searchParams.get("pageSize"), 20)
    : 20;

  return {
    hospital: searchParams.get("hospital") ?? "",
    name: searchParams.get("name") ?? "",
    hn: searchParams.get("hn") ?? "",
    sex: searchParams.get("sex") ?? "",
    page: normalizePage(searchParams.get("page"), 1),
    pageSize,
  };
}

function formatDate(input: string | null) {
  if (!input) return "-";
  return new Date(input).toLocaleDateString("th-TH");
}

export function PatientDataGrid() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(() => stateFromSearchParams(searchParams), [searchParams]);

  const [rows, setRows] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>(initial);
  const [selectedRow, setSelectedRow] = useState<PatientRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [draft, setDraft] = useState<PatientEditDraft>(EMPTY_DRAFT);

  useEffect(() => {
    setFilters(stateFromSearchParams(searchParams));
  }, [searchParams]);

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
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      page: String(filters.page),
      pageSize: String(filters.pageSize),
    });

    if (filters.hospital.trim()) params.set("hospital", filters.hospital.trim());
    if (filters.name.trim()) params.set("name", filters.name.trim());
    if (filters.hn.trim()) params.set("hn", filters.hn.trim());
    if (filters.sex) params.set("sex", filters.sex);

    fetch(`/api/patient?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Failed to load patient data");
        }
        return response.json() as Promise<GridResponse>;
      })
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
  }, [filters, pathname, router, searchParams]);

  const totalPages = useMemo(
    () => (total > 0 ? Math.max(1, Math.ceil(total / filters.pageSize)) : 1),
    [filters.pageSize, total],
  );

  const updateFilter = (patch: Partial<FilterState>) => {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
  };

  const startEdit = (row: PatientRow) => {
    setSelectedRow(row);
    setDraft({
      hosname: row.hosname ?? "",
      hn: row.hn ?? "",
      patient_name: row.patient_name ?? "",
      sex: row.sex ?? "",
      triage: row.triage ?? "",
      status: row.status ?? "",
    });
    setIsModalOpen(true);
  };

  const cancelEdit = () => {
    setIsModalOpen(false);
    setSelectedRow(null);
    setDraft(EMPTY_DRAFT);
  };

  const saveEdit = async () => {
    if (!selectedRow) return;

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/patient/${selectedRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Failed to update");
      setRows((current) =>
        current.map((row) => (row.id === selectedRow.id ? (payload.row as PatientRow) : row)),
      );
      cancelEdit();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-8">
      <div className="border border-sky-200 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
        <div className="flex flex-col gap-2 border-b border-sky-100 pb-4">
          <h1 className="text-[12px] font-semibold text-slate-900">Patient Data Grid</h1>
          <p className="text-[12px] text-slate-600">
            กรองข้อมูลตามโรงพยาบาล, ชื่อ-นามสกุล, HN และเพศ พร้อมแก้ไขข้อมูลได้ในตาราง
          </p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="กรอง รพ."
            value={filters.hospital}
            onChange={(event) => {
              updateFilter({ hospital: event.target.value, page: 1 });
            }}
          />
          <input
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="กรอง ชื่อ-นามสกุล"
            value={filters.name}
            onChange={(event) => {
              updateFilter({ name: event.target.value, page: 1 });
            }}
          />
          <input
            className="h-9 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            placeholder="กรอง HN"
            value={filters.hn}
            onChange={(event) => {
              updateFilter({ hn: event.target.value, page: 1 });
            }}
          />
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
          <button
            type="button"
            className="h-9 border border-sky-200 bg-sky-50 px-3 text-[12px] font-medium text-sky-800 transition hover:bg-sky-100"
            onClick={() => {
              setFilters((current) => ({
                ...current,
                hospital: "",
                name: "",
                hn: "",
                sex: "",
                page: 1,
              }));
            }}
          >
            ล้างตัวกรอง
          </button>
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

        <div className="mt-5 overflow-x-auto border border-sky-200">
          <table className="w-full min-w-[1250px] border-collapse">
            <thead className="bg-sky-50 text-left text-xs uppercase tracking-[0.16em] text-sky-900">
              <tr>
                <th className="px-3 py-3">ID</th>
                <th className="px-3 py-3">วันที่</th>
                <th className="px-3 py-3">รพ.</th>
                <th className="px-3 py-3">HN</th>
                <th className="px-3 py-3">ชื่อ-นามสกุล</th>
                <th className="px-3 py-3">เพศ</th>
                <th className="px-3 py-3">อายุ</th>
                <th className="px-3 py-3">Triage</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">PDX</th>
                <th className="px-3 py-3">EXT-DX</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[12px] text-slate-700">
              {rows.map((row) => {
                return (
                  <tr
                    key={row.id}
                    className="border-t border-sky-100 align-top odd:bg-white even:bg-sky-50/50"
                  >
                    <td className="px-3 py-3">{row.id}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(row.dateserv)}</td>
                    <td className="px-3 py-3">{row.hosname ?? "-"}</td>
                    <td className="px-3 py-3">{row.hn ?? "-"}</td>
                    <td className="px-3 py-3">{row.patient_name ?? "-"}</td>
                    <td className="px-3 py-3">{row.sex ?? "-"}</td>
                    <td className="px-3 py-3">{row.age ?? "-"}</td>
                    <td className="px-3 py-3">{row.triage ?? "-"}</td>
                    <td className="px-3 py-3">{row.status ?? "-"}</td>
                    <td className="px-3 py-3">
                      {row.pdx?.code ? `${row.pdx.code} - ${row.pdx.name ?? ""}` : "-"}
                    </td>
                    <td className="px-3 py-3">
                      {row.ext_dx?.code ? `${row.ext_dx.code} - ${row.ext_dx.name ?? ""}` : "-"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                          onClick={() => startEdit(row)}
                          title="Edit"
                        >
                          <SquarePen size={16} />
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
                    Update Record
                  </h2>
                  <p className="mt-1 text-[12px] text-slate-600">
                    แก้ไขข้อมูลผู้ป่วยเฉพาะฟิลด์ที่ต้องใช้ในงานประจำวัน
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

              <div className="mt-4 grid gap-2 text-[12px] text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">ID</span>
                  <span className="font-medium text-slate-900">{selectedRow.id}</span>
                </div>
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">วันที่</span>
                  <span className="font-medium text-slate-900">{formatDate(selectedRow.dateserv)}</span>
                </div>
                <div className="rounded-none border border-sky-100 bg-sky-50/60 px-3 py-2">
                  <span className="block text-slate-500">HN</span>
                  <span className="font-medium text-slate-900">{selectedRow.hn ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-[12px] text-slate-700">
                  <span>Hospital name</span>
                  <input
                    className="h-11 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    value={draft.hosname}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, hosname: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700">
                  <span>HN</span>
                  <input
                    className="h-11 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    value={draft.hn}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, hn: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700 sm:col-span-2">
                  <span>Patient name</span>
                  <input
                    className="h-11 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    value={draft.patient_name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, patient_name: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700">
                  <span>Sex</span>
                  <select
                    className="h-11 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    value={draft.sex}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sex: event.target.value }))
                    }
                  >
                    <option value="">-</option>
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700">
                  <span>Triage</span>
                  <input
                    className="h-11 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    value={draft.triage}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, triage: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-[12px] text-slate-700 sm:col-span-2">
                  <span>Status</span>
                  <input
                    className="h-11 border border-sky-200 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, status: event.target.value }))
                    }
                  />
                </label>
              </div>

              <div className="space-y-4 border border-sky-100 bg-sky-50/40 p-4">
                <div>
                  <div className="text-[12px] font-medium text-slate-900">Read only</div>
                  <div className="mt-1 text-[12px] text-slate-600">
                    ดูข้อมูลประกอบสำหรับตรวจสอบก่อนบันทึก
                  </div>
                </div>

                <div className="grid gap-3 text-[12px] text-slate-700">
                  <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-3">
                    <span className="text-slate-500">Hospital code</span>
                    <span className="text-right font-medium text-slate-900">{selectedRow.hoscode ?? "-"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-3">
                    <span className="text-slate-500">Age</span>
                    <span className="text-right font-medium text-slate-900">{selectedRow.age ?? "-"}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-sky-100 pb-3">
                    <span className="text-slate-500">PDX</span>
                    <span className="max-w-[220px] text-right font-medium text-slate-900">
                      {selectedRow.pdx?.code ? `${selectedRow.pdx.code} - ${selectedRow.pdx.name ?? ""}` : "-"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-slate-500">EXT-DX</span>
                    <span className="max-w-[220px] text-right font-medium text-slate-900">
                      {selectedRow.ext_dx?.code ? `${selectedRow.ext_dx.code} - ${selectedRow.ext_dx.name ?? ""}` : "-"}
                    </span>
                  </div>
                </div>
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
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
