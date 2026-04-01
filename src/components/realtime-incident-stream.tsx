"use client";

import { createClient } from "@supabase/supabase-js";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type IncidentRow = {
  id: number;
  title: string;
  body: string | null;
  severity: "info" | "warning" | "critical";
  created_at: string;
};

type StreamProps = {
  supabaseUrl: string;
  supabaseKey: string;
};

const severityLabel: Record<IncidentRow["severity"], string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

export function RealtimeIncidentStream({ supabaseUrl, supabaseKey }: StreamProps) {
  const supabase = useMemo(
    () =>
      createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    [supabaseKey, supabaseUrl],
  );

  const [items, setItems] = useState<IncidentRow[]>([]);
  const [status, setStatus] = useState("connecting");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<IncidentRow["severity"]>("info");
  const [draftBody, setDraftBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadInitialRows = async () => {
      const { data, error: loadError } = await supabase
        .schema("accident")
        .from("notifications")
        .select("id,title,body,severity,created_at")
        .order("created_at", { ascending: false })
        .limit(12);

      if (!mounted) {
        return;
      }

      if (loadError) {
        setError(loadError.message);
        setStatus("offline");
        return;
      }

      setItems((data ?? []) as IncidentRow[]);
    };

    const channel = supabase
      .channel("accident-notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "accident",
          table: "notifications",
        },
        (payload) => {
          const record = (payload.new ?? payload.old) as IncidentRow | undefined;

          if (!record) {
            return;
          }

          setItems((current) => {
            const next = [record, ...current.filter((item) => item.id !== record.id)];
            return next.slice(0, 12);
          });
          setStatus("live");
        },
      )
      .subscribe((subscriptionStatus) => {
        if (!mounted) {
          return;
        }

        if (subscriptionStatus === "SUBSCRIBED") {
          setStatus("live");
          setError(null);
        } else if (subscriptionStatus === "TIMED_OUT") {
          setStatus("timed out");
        } else if (subscriptionStatus === "CHANNEL_ERROR") {
          setStatus("error");
        } else if (subscriptionStatus === "CLOSED") {
          setStatus("closed");
        } else {
          setStatus(String(subscriptionStatus).toLowerCase());
        }
      });

    void loadInitialRows();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const submitNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Type a short title for the notification.");
      return;
    }

    const { error: insertError } = await supabase
      .schema("accident")
      .from("notifications")
      .insert({
        body: draftBody.trim() || null,
        severity,
        title: trimmedMessage,
      });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setMessage("");
    setDraftBody("");
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
      <div className="border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">
              Live feed
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Accident notifications
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">
              Connection
            </p>
            <p className="mt-2 text-sm font-medium text-emerald-300">{status}</p>
          </div>
        </div>

        <form className="mt-6 grid gap-3" onSubmit={submitNotification}>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.28em] text-white/50">
                Title
              </span>
              <input
                className="h-12 border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/50"
                placeholder="New vehicle incident on Rama IV"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.28em] text-white/50">
                Severity
              </span>
              <select
                className="h-12 border border-white/10 bg-slate-950/60 px-4 text-sm text-white outline-none transition focus:border-cyan-300/50"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as IncidentRow["severity"])}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.28em] text-white/50">
              Details
            </span>
            <textarea
              className="min-h-28 border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/50"
              placeholder="Short description for operators or drivers."
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-white/45">
              Insert a row and watch it arrive through Supabase Realtime.
            </p>
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              Send notification
            </button>
          </div>

          {error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : (
            <p className="text-sm text-emerald-300">Ready to publish to the stream.</p>
          )}
        </form>
      </div>

      <aside className="border border-white/10 bg-slate-950/55 p-6">
        <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/45">
              Recent rows
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">
              Last 12 events
            </h3>
          </div>
          <p className="text-sm text-white/45">{items.length} loaded</p>
        </div>

        <div className="mt-4 grid gap-3">
          {items.length === 0 ? (
            <div className="border border-dashed border-white/10 px-4 py-10 text-sm text-white/45">
              No rows yet. Add one from the form or via SQL.
            </div>
          ) : (
            items.map((item) => (
              <article key={item.id} className="border border-white/8 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <span className="text-[11px] uppercase tracking-[0.24em] text-cyan-300">
                    {severityLabel[item.severity]}
                  </span>
                </div>
                {item.body ? (
                  <p className="mt-2 text-sm leading-6 text-white/65">{item.body}</p>
                ) : null}
                <p className="mt-3 text-xs uppercase tracking-[0.24em] text-white/35">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </article>
            ))
          )}
        </div>
      </aside>
    </section>
  );
}
