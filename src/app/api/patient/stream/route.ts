import { Client } from "pg";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;
const STREAM_HEARTBEAT_MS = Number.parseInt(process.env.PATIENT_STREAM_HEARTBEAT_MS ?? "20000", 10);
const STREAM_MAX_DURATION_MS = Number.parseInt(process.env.PATIENT_STREAM_MAX_DURATION_MS ?? "240000", 10);
const STREAM_RETRY_MS = Number.parseInt(process.env.NEXT_PUBLIC_PATIENT_STREAM_RETRY_MS ?? "5000", 10);

export const runtime = "nodejs";

export async function GET(request: Request) {
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
  let closed = false;

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

    try {
      await client.query("UNLISTEN patient_grid_change");
    } catch {
      // ignore cleanup errors
    }

    await client.end().catch(() => undefined);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const onNotification = (message: { payload?: string | null }) => {
        const payload = message.payload ?? "{}";
        controller.enqueue(encoder.encode(`event: message\ndata: ${payload}\n\n`));
      };

      client.on("notification", onNotification);

      controller.enqueue(encoder.encode(`retry: ${STREAM_RETRY_MS}\n\n`));
      controller.enqueue(encoder.encode(`event: ready\ndata: {"ok":true}\n\n`));

      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
      }, STREAM_HEARTBEAT_MS);

      shutdownTimer = setTimeout(() => {
        client.off("notification", onNotification);
        void closeStream().finally(() => controller.close());
      }, STREAM_MAX_DURATION_MS);

      request.signal.addEventListener("abort", () => {
        client.off("notification", onNotification);
        void closeStream().finally(() => controller.close());
      });
    },
    cancel() {
      void closeStream();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
