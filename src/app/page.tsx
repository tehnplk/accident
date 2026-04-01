import { RealtimeIncidentStream } from "@/components/realtime-incident-stream";
import { createLocalSupabaseToken, localSupabaseUrl } from "@/lib/supabase/local-jwt";

export default function Home() {
  const token = createLocalSupabaseToken("service_role");

  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] text-slate-900">
      <section className="relative isolate border-b border-sky-200/70 px-6 py-8 sm:px-10 lg:px-14">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.26),_transparent_26%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.96),_rgba(239,246,255,0.92))]" />
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 lg:gap-12">
          <header className="flex flex-col gap-4 border-b border-sky-200/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.38em] text-sky-600">
                Supabase Realtime / accident
              </p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Live incident feed, wired straight to the database.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                This Next.js app is connected to the local Supabase stack already
                running on this machine. Rows inserted into `accident.notifications`
                appear instantly without a page refresh.
              </p>
            </div>
            <div className="grid gap-2 rounded-2xl border border-sky-200 bg-white/80 px-4 py-3 text-sm text-slate-600 shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <span className="uppercase tracking-[0.28em] text-sky-500">
                Endpoint
              </span>
              <span className="font-mono text-slate-900">{localSupabaseUrl}</span>
              <span className="mt-2 uppercase tracking-[0.28em] text-sky-500">
                Channel
              </span>
              <span className="font-mono text-slate-900">accident.notifications</span>
            </div>
          </header>

          <RealtimeIncidentStream
            supabaseKey={token}
            supabaseUrl={localSupabaseUrl}
          />
        </div>
      </section>
    </main>
  );
}
