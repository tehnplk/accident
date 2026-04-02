"use client";

import Link from "next/link";
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

const vehicleSegments = [
  { label: "รถจักรยานยนต์", value: 42, color: "#1e3a8a" },
  { label: "รถเก๋ง / แท็กซี่", value: 18, color: "#475569" },
  { label: "รถกระบะ", value: 14, color: "#0f766e" },
  { label: "รถบรรทุก", value: 8, color: "#64748b" },
  { label: "อื่น ๆ", value: 18, color: "#cbd5e1" },
];

const alcoholSegments = [
  { label: "ไม่ดื่ม", value: 62, color: "#334155" },
  { label: "ดื่ม", value: 21, color: "#b45309" },
  { label: "ไม่ทราบ", value: 17, color: "#94a3b8" },
];

const injuryOutcomeSegments = [
  { label: "บาดเจ็บ", value: 96, color: "#475569" },
  { label: "เสียชีวิต", value: 4, color: "#b91c1c" },
];

const districtRows = [
  { district: "เมืองพิษณุโลก", cases: 18, deaths: 1 },
  { district: "บางระกำ", cases: 15, deaths: 2 },
  { district: "วังทอง", cases: 12, deaths: 1 },
  { district: "พรหมพิราม", cases: 10, deaths: 0 },
  { district: "นครไทย", cases: 8, deaths: 1 },
];

const dailyCases = [
  { label: "10 เม.ย. 69", value: 8 },
  { label: "11 เม.ย. 69", value: 11 },
  { label: "12 เม.ย. 69", value: 7 },
  { label: "13 เม.ย. 69", value: 14 },
  { label: "14 เม.ย. 69", value: 10 },
  { label: "15 เม.ย. 69", value: 13 },
  { label: "16 เม.ย. 69", value: 12 },
  { label: "17 เม.ย. 69", value: 9 },
  { label: "18 เม.ย. 69", value: 15 },
  { label: "19 เม.ย. 69", value: 11 },
  { label: "20 เม.ย. 69", value: 16 },
  { label: "21 เม.ย. 69", value: 14 },
  { label: "22 เม.ย. 69", value: 12 },
  { label: "23 เม.ย. 69", value: 17 },
];

function formatPercent(value: number, total: number) {
  return `${Math.round((value / total) * 100)}%`;
}

function ChartPanel({
  title,
  subtitle,
  segments,
}: {
  title: string;
  subtitle: string;
  segments: typeof vehicleSegments;
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
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">
            {title}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            {subtitle}
          </h2>
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
              <div className="text-3xl font-semibold tracking-tight text-slate-900">
                {total}
              </div>
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
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm font-medium text-slate-800">
                  {segment.label}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">
                  {segment.value}
                </div>
                <div className="text-xs text-slate-500">
                  {formatPercent(segment.value, total)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BarChartPanel() {
  const labels = districtRows.map((row) => row.district);
  const data = {
    labels,
    datasets: [
      {
        label: "จำนวนเคส",
        data: districtRows.map((row) => row.cases),
        backgroundColor: "#64748b",
        borderRadius: 12,
        borderSkipped: false,
      },
      {
        label: "เสียชีวิต",
        data: districtRows.map((row) => row.deaths),
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
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">
            Bar Chart
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            รายอำเภอ
          </h2>
        </div>
        <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
          {districtRows.length} อำเภอ
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

function LineChartPanel() {
  const data = {
    labels: dailyCases.map((item) => item.label),
    datasets: [
      {
        label: "จำนวนเคสรายวัน",
        data: dailyCases.map((item) => item.value),
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
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">
            Line Chart
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            จำนวนเคสรายวัน
          </h2>
        </div>
        <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
          7 วันล่าสุด
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

export default function DashboardHome() {
  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[30px] border border-sky-100/80 bg-white/80 px-5 py-4 shadow-[0_18px_55px_rgba(37,99,235,0.06)] backdrop-blur-sm sm:px-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-500">
                Accident Dashboard
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                ภาพรวมผู้บาดเจ็บจากอุบัติเหตุทางถนนเทศกาลสงกรานต์ 10 - 21 เม.ย. 2569
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                สำนักงานสาธารณสุขจังหวัดพิษณุโลก (ข้อมูลทดสอบระบบ)
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
            </nav>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-2">
          <ChartPanel
            title="Summary Chart"
            subtitle="บาดเจ็บ / เสียชีวิต"
            segments={injuryOutcomeSegments}
          />
          <ChartPanel
            title="Pie Chart"
            subtitle="สุรา"
            segments={alcoholSegments}
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <ChartPanel
            title="Pie Chart"
            subtitle="ประเภทรถ"
            segments={vehicleSegments}
          />
          <BarChartPanel />
        </section>

        <section className="grid gap-6">
          <LineChartPanel />
        </section>
      </div>
    </main>
  );
}
