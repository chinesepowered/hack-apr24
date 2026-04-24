import type { NextRequest } from "next/server";
import { isTerminal, replay, subscribe } from "@/lib/orchestrator/bus";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller already closed
        }
      };

      for (const event of replay(id)) send(event);

      if (isTerminal(id)) {
        controller.close();
        return;
      }

      const unsub = subscribe(id, (event) => {
        send(event);
        if (event.kind === "run_completed") {
          unsub();
          try {
            controller.close();
          } catch {
            // Ignore
          }
        }
      });

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(keepAlive);
        }
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsub();
        try {
          controller.close();
        } catch {
          // Ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
