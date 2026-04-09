"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Activity, Clock3, Skull, Users, X } from "lucide-react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import type {
  DashboardBarRow,
  DashboardLinePoint,
  DashboardLastSyncRow,
  DashboardSegment,
  DashboardSummary,
} from "@/lib/dashboard-summary";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

type DashboardHomeProps = {
  initialData: DashboardSummary;
};

function LastSyncDialog({
  rows,
  onClose,
}: {
  rows: DashboardLastSyncRow[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-5 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden border border-sky-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="last-sync-dialog-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-sky-50/50 px-4 py-4 sm:px-5">
          <div>
            <h2 id="last-sync-dialog-title" className="text-[14px] font-semibold text-slate-900">
              Last Sync
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">เวลาล่าสุดของแต่ละโรงพยาบาลจากตาราง sync_log</p>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
            onClick={onClose}
            aria-label="Close last sync dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div className="overflow-hidden border border-sky-100 bg-white">
            <table className="min-w-full divide-y divide-sky-100 text-[12px]">
              <thead className="bg-sky-50/70 text-slate-600">
                <tr>
                  <th className="w-16 px-3 py-3 text-left font-semibold">#</th>
                  <th className="w-28 px-3 py-3 text-left font-semibold">hoscode</th>
                  <th className="px-3 py-3 text-left font-semibold">hosname</th>
                  <th className="w-56 px-3 py-3 text-left font-semibold">date_time_sync</th>
                  <th className="w-24 px-3 py-3 text-right font-semibold">rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                      ยังไม่มีข้อมูล sync_log
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={`${row.hoscode}-${row.hosname}-${row.dateTimeSync}`} className="text-slate-700">
                      <td className="px-3 py-3">{index + 1}</td>
                      <td className="whitespace-nowrap px-3 py-3">{row.hoscode}</td>
                      <td className="px-3 py-3">{row.hosname}</td>
                      <td className="whitespace-nowrap px-3 py-3">{row.dateTimeSync}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">{row.rows}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  className,
  iconClassName,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  className: string;
  iconClassName: string;
}) {
  return (
    <div className={`rounded-[26px] border p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">{label}</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-4xl font-semibold tracking-tight text-slate-950">{value}</span>
            <span className="pb-1 text-base font-medium text-slate-600">ราย</span>
          </div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${iconClassName}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function formatPercent(value: number, total: number) {
  if (!Number.isFinite(total) || total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function toThaiDate(isoDate: string | null) {
  if (!isoDate) return "-";

  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = match[3];
  const monthLabels = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ];
  const monthLabel = monthLabels[month - 1];
  if (!monthLabel || !Number.isFinite(year)) return isoDate;

  return `${day} ${monthLabel} ${(year + 543).toString().slice(-2)}`;
}

function formatDateRange(minDate: string | null, maxDate: string | null) {
  if (!minDate && !maxDate) return "ยังไม่มีข้อมูล";
  if (minDate && maxDate && minDate === maxDate) return `${toThaiDate(minDate)} ถึง ${toThaiDate(maxDate)}`;
  if (!minDate) return toThaiDate(maxDate);
  if (!maxDate) return toThaiDate(minDate);
  return `${toThaiDate(minDate)} ถึง ${toThaiDate(maxDate)}`;
}

function ChartPanel({
  title,
  subtitle,
  segments,
}: {
  title: string;
  subtitle: string;
  segments: DashboardSegment[];
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const data = {
    labels: segments.map((segment) => segment.label),
    datasets: [
      {
        data: segments.map((segment) => segment.value),
        backgroundColor: segments.map((segment) => segment.color),
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  return (
    <section className="rounded-[28px] border border-sky-100/80 bg-white/90 p-6 shadow-[0_18px_55px_rgba(37,99,235,0.08)] backdrop-blur-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">{title}</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{subtitle}</h2>
        </div>
        <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
          รวม {total} เคส
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <div className="relative min-h-[260px]">
          <Doughnut
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: "72%",
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: "#111827",
                  padding: 12,
                  cornerRadius: 12,
                },
              },
            }}
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-3xl font-semibold tracking-tight text-slate-900">{total}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                เคสทั้งหมด
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="text-sm font-medium text-slate-800">{segment.label}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{segment.value}</div>
                <div className="text-xs text-slate-500">{formatPercent(segment.value, total)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BarChartPanel({ rows }: { rows: DashboardBarRow[] }) {
  const labels = rows.map((row) => row.district);
  const data = {
    labels,
    datasets: [
      {
        label: "จำนวนเคส",
        data: rows.map((row) => row.cases),
        backgroundColor: "#64748b",
        borderRadius: 12,
        borderSkipped: false,
      },
      {
        label: "เสียชีวิต",
        data: rows.map((row) => row.deaths),
        backgroundColor: "#b91c1c",
        borderRadius: 12,
        borderSkipped: false,
      },
    ],
  };

  return (
    <section className="rounded-[28px] border border-sky-100/80 bg-white/90 p-6 shadow-[0_18px_55px_rgba(37,99,235,0.08)] backdrop-blur-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Bar Chart</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">จำนวนเคสแยกรายพื้นที่ที่เกิดเหตุ</h2>
        </div>
        <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
          {rows.length} อำเภอ
        </div>
      </div>

      <div className="h-[340px]">
        <Bar
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",
            plugins: {
              legend: {
                position: "top",
                labels: {
                  usePointStyle: true,
                  boxWidth: 10,
                },
              },
              tooltip: {
                backgroundColor: "#111827",
                padding: 12,
                cornerRadius: 12,
              },
            },
            scales: {
              x: {
                beginAtZero: true,
                grid: { color: "rgba(100, 116, 139, 0.16)" },
              },
              y: {
                grid: { display: false },
              },
            },
          }}
        />
      </div>
    </section>
  );
}

function LineChartPanel({
  points,
  dateRangeLabel,
}: {
  points: DashboardLinePoint[];
  dateRangeLabel: string;
}) {
  const data = {
    labels: points.map((item) => toThaiDate(item.label)),
    datasets: [
      {
        label: "จำนวนเคสรายวัน",
        data: points.map((item) => item.value),
        borderColor: "#b91c1c",
        backgroundColor: "rgba(185, 28, 28, 0.10)",
        pointBackgroundColor: "#7f1d1d",
        pointBorderColor: "#ffffff",
        pointHoverRadius: 6,
        tension: 0.38,
        fill: true,
      },
    ],
  };

  return (
    <section className="rounded-[28px] border border-sky-100/80 bg-white/90 p-6 shadow-[0_18px_55px_rgba(37,99,235,0.08)] backdrop-blur-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Line Chart</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">จำนวนเคสรายวัน</h2>
        </div>
        <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
          {dateRangeLabel}
        </div>
      </div>

      <div className="h-[340px]">
        <Line
          data={data}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                backgroundColor: "#111827",
                padding: 12,
                cornerRadius: 12,
              },
            },
            scales: {
              x: {
                grid: { color: "rgba(100, 116, 139, 0.16)" },
              },
              y: {
                beginAtZero: true,
                grid: { color: "rgba(100, 116, 139, 0.16)" },
              },
            },
          }}
        />
      </div>
    </section>
  );
}

export default function DashboardHome({ initialData }: DashboardHomeProps) {
  const [isLastSyncOpen, setIsLastSyncOpen] = useState(false);
  const dateRangeLabel = formatDateRange(initialData.minVisitDate, initialData.maxVisitDate);
  const deathCount = initialData.deathCases;
  const injuredCount = Math.max(initialData.totalCases - deathCount, 0);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[30px] border border-sky-100/80 bg-white/80 px-5 py-4 shadow-[0_18px_55px_rgba(37,99,235,0.06)] backdrop-blur-sm sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-100 bg-white shadow-sm">
                  <Image src="/logo.png" alt="สำนักงานสาธารณสุขจังหวัดพิษณุโลก" width={40} height={40} className="h-10 w-10 object-contain" />
                </div>
                <p className="text-sm font-semibold tracking-[0.08em] text-sky-500">
                  สำนักงานสาธารณสุขจังหวัดพิษณุโลก
                </p>
              </div>
              <h1 className="mt-2 text-sm font-semibold tracking-tight text-slate-950 sm:text-lg">
                ข้อมูลผู้ได้รับบาดเจ็บและเสียชีวิตจากอุบัติเหตุทางถนนในช่วงเทศกาลสงกรานต์ ปี 2569 จังหวัดพิษณุโลก
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                ตั้งแต่วันที่ <span className="font-semibold text-slate-900">{dateRangeLabel}</span>
              </p>
            </div>

            <nav className="flex items-center gap-2 text-sm font-medium">
              <span className="rounded-full bg-sky-600 px-4 py-2 text-white shadow-sm">
                Dashboard
              </span>
              <Link
                href="/patient"
                className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Patient
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                onClick={() => setIsLastSyncOpen(true)}
              >
                <Clock3 className="h-4 w-4" />
                Last Sync
              </button>
            </nav>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            label="ทั้งหมด"
            value={initialData.totalCases}
            icon={<Users className="h-6 w-6" />}
            className="border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-cyan-50"
            iconClassName="border-sky-200 bg-white text-sky-600"
          />
          <SummaryCard
            label="บาดเจ็บ"
            value={injuredCount}
            icon={<Activity className="h-6 w-6" />}
            className="border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50"
            iconClassName="border-amber-200 bg-white text-amber-600"
          />
          <SummaryCard
            label="เสียชีวิต"
            value={deathCount}
            icon={<Skull className="h-6 w-6" />}
            className="border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-red-50"
            iconClassName="border-rose-200 bg-white text-rose-700"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ChartPanel
            title="Summary Chart"
            subtitle="สถานะผู้ป่วย"
            segments={initialData.statusSegments}
          />
          <ChartPanel title="Pie Chart" subtitle="การดื่มสุรา" segments={initialData.alcoholSegments} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ChartPanel title="Pie Chart" subtitle="ประเภทรถ" segments={initialData.vehicleSegments} />
          <BarChartPanel rows={initialData.districtRows} />
        </section>

        <section className="grid gap-6">
          <LineChartPanel points={initialData.dailyCases} dateRangeLabel={dateRangeLabel} />
        </section>
      </div>
      {isLastSyncOpen ? (
        <LastSyncDialog rows={initialData.lastSyncRows} onClose={() => setIsLastSyncOpen(false)} />
      ) : null}
    </main>
  );
}
