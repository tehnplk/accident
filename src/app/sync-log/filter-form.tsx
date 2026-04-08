"use client";

import { useRouter, useSearchParams } from "next/navigation";

type HospitalOption = {
  hoscode: string;
  hosname: string | null;
};

type SyncLogFilterFormProps = {
  hospitals: HospitalOption[];
  selectedHospital: string;
  dateFrom: string;
  dateTo: string;
  latestOnly: boolean;
};

export default function SyncLogFilterForm({
  hospitals,
  selectedHospital,
  dateFrom,
  dateTo,
  latestOnly,
}: SyncLogFilterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const applyFilters = (
    nextHospital: string,
    nextDateFrom: string,
    nextDateTo: string,
    nextLatestOnly: boolean,
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    if (nextHospital) params.set("hospital", nextHospital);
    else params.delete("hospital");

    if (nextDateFrom) params.set("dateFrom", nextDateFrom);
    else params.delete("dateFrom");

    if (nextDateTo) params.set("dateTo", nextDateTo);
    else params.delete("dateTo");

    if (nextLatestOnly) params.set("latestOnly", "1");
    else params.delete("latestOnly");

    const query = params.toString();
    router.push(query ? `/sync-log?${query}` : "/sync-log");
  };

  return (
    <section className="rounded-[28px] border border-sky-100/80 bg-white/95 px-6 py-5 shadow-[0_18px_55px_rgba(37,99,235,0.08)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <div>
          <label htmlFor="hospital" className="mb-2 block text-sm font-medium text-slate-700">
            รพ.
          </label>
          <select
            id="hospital"
            name="hospital"
            value={selectedHospital}
            onChange={(event) => applyFilters(event.target.value, dateFrom, dateTo, latestOnly)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          >
            <option value="">ทั้งหมด</option>
            {hospitals.map((hospital) => (
              <option key={hospital.hoscode} value={hospital.hoscode}>
                {hospital.hoscode} {hospital.hosname || ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dateFrom" className="mb-2 block text-sm font-medium text-slate-700">
            วันที่เริ่ม
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(event) => applyFilters(selectedHospital, event.target.value, dateTo, latestOnly)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <div>
          <label htmlFor="dateTo" className="mb-2 block text-sm font-medium text-slate-700">
            วันที่สิ้นสุด
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            value={dateTo}
            onChange={(event) => applyFilters(selectedHospital, dateFrom, event.target.value, latestOnly)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyFilters(selectedHospital, dateFrom, dateTo, !latestOnly)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              latestOnly
                ? "bg-sky-600 text-white hover:bg-sky-700"
                : "border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`}
          >
            ดูล่าสุดของแต่ละ รพ.
          </button>
          <button
            type="button"
            onClick={() => applyFilters("", "", "", false)}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            ล้างตัวกรอง
          </button>
        </div>
      </div>
    </section>
  );
}
