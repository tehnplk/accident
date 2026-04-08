import Link from "next/link";
import { dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

type SyncLogRow = {
  id: string;
  date_time: string;
  hoscode: string | null;
  hosname: string | null;
  num_pt_case: number;
};

async function loadSyncLogs() {
  const result = await dbQuery<SyncLogRow>(`
    SELECT
      id::text AS id,
      to_char(date_time AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS') AS date_time,
      hoscode,
      hosname,
      num_pt_case
    FROM public.sync_log
    ORDER BY date_time DESC, id DESC
  `);

  return result.rows;
}

export default async function SyncLogPage() {
  const rows = await loadSyncLogs();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[28px] border border-sky-100/80 bg-white/90 px-6 py-5 shadow-[0_18px_55px_rgba(37,99,235,0.08)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Sync Log</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">รายการ sync_log</h1>
              <p className="mt-2 text-sm text-slate-500">เรียงตามวันเวลาใหม่สุดไปเก่าสุด</p>
            </div>

            <nav className="flex items-center gap-2 text-sm font-medium">
              <Link
                href="/"
                className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Dashboard
              </Link>
              <Link
                href="/patient"
                className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Patient
              </Link>
              <span className="rounded-full bg-sky-600 px-4 py-2 text-white shadow-sm">Sync Log</span>
            </nav>
          </div>
        </header>

        <section className="overflow-hidden rounded-[28px] border border-sky-100/80 bg-white/95 shadow-[0_18px_55px_rgba(37,99,235,0.08)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Date Time</th>
                  <th className="px-4 py-3">Hoscode</th>
                  <th className="px-4 py-3">Hosname</th>
                  <th className="px-4 py-3 text-right">Num Pt Case</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                      ยังไม่มีข้อมูล sync_log
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="align-top text-slate-700">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.id}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.date_time}</td>
                      <td className="whitespace-nowrap px-4 py-3">{row.hoscode || "-"}</td>
                      <td className="px-4 py-3">{row.hosname || "-"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-900">
                        {row.num_pt_case}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
