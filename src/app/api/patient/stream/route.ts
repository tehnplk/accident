import { Client } from "pg";
import { patientApiAuthorized } from "@/lib/patient-security";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;
const STREAM_HEARTBEAT_MS = Number.parseInt(process.env.PATIENT_STREAM_HEARTBEAT_MS ?? "20000", 10);
const STREAM_MAX_DURATION_MS = Number.parseInt(process.env.PATIENT_STREAM_MAX_DURATION_MS ?? "240000", 10);
const STREAM_RETRY_MS = Number.parseInt(process.env.NEXT_PUBLIC_PATIENT_STREAM_RETRY_MS ?? "5000", 10);
const STREAM_COALESCE_MS = Number.parseInt(process.env.PATIENT_STREAM_COALESCE_MS ?? "1000", 10);

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!patientApiAuthorized(request)) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.DATABASE_URL) {
    return new Response("DATABASE_URL is required", { status: 500 });
  }

  const encoder = new TextEncoder();
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();
  await client.query("LISTEN patient_grid_change");

  let heartbeat: NodeJS.Timeout | null = null;
  let shutdownTimer: NodeJS.Timeout | null = null;
  let notifyTimer: NodeJS.Timeout | null = null;
  let closed = false;
  let streamClosed = false;

  const closeStream = async () => {
    if (closed) return;
    closed = true;

    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }

    if (shutdownTimer) {
      clearTimeout(shutdownTimer);
      shutdownTimer = null;
    }

    if (notifyTimer) {
      clearTimeout(notifyTimer);
      notifyTimer = null;
    }

    try {
      await client.query("UNLISTEN patient_grid_change");
    } catch {
      // ignore cleanup errors
    }

    await client.end().catch(() => undefined);
  };

  const closeController = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (streamClosed) return;
    streamClosed = true;

    try {
      controller.close();
    } catch {
      // ignore already-closed controller
    }
  };

  const enqueueEvent = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: string,
    data: string,
  ) => {
    if (streamClosed) return false;

    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      return true;
    } catch {
      streamClosed = true;
      return false;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let hasPendingNotification = false;

      const shutdown = () => {
        client.off("notification", onNotification);
        void closeStream().finally(() => closeController(controller));
      };

      const flushNotification = () => {
        notifyTimer = null;
        if (!hasPendingNotification) return;
        hasPendingNotification = false;

        if (!enqueueEvent(controller, "message", '{"batched":true}')) {
          shutdown();
        }
      };

      const onNotification = (_message: { payload?: string | null }) => {
        hasPendingNotification = true;
        if (notifyTimer) return;
        notifyTimer = setTimeout(flushNotification, Math.max(STREAM_COALESCE_MS, 250));
      };

      client.on("notification", onNotification);

      if (!streamClosed) {
        try {
          controller.enqueue(encoder.encode(`retry: ${STREAM_RETRY_MS}\n\n`));
        } catch {
          streamClosed = true;
        }
      }
      if (!streamClosed && !enqueueEvent(controller, "ready", '{"ok":true}')) {
        shutdown();
        return;
      }

      heartbeat = setInterval(() => {
        if (!enqueueEvent(controller, "ping", "{}")) {
          shutdown();
        }
      }, STREAM_HEARTBEAT_MS);

      shutdownTimer = setTimeout(() => {
        shutdown();
      }, STREAM_MAX_DURATION_MS);

      request.signal.addEventListener("abort", shutdown, { once: true });
    },
    cancel() {
      void closeStream();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
