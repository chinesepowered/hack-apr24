import { startRun } from "@/lib/orchestrator/run";
import { listRuns } from "@/lib/orchestrator/bus";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    speed?: number;
  };
  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  startRun({ runId, speed: body.speed });
  return Response.json({ runId });
}

export async function GET(): Promise<Response> {
  return Response.json({ runs: listRuns() });
}
