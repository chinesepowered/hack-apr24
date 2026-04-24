import { spawn } from "node:child_process";
import path from "node:path";
import { type Issue, type Plan, demoPlan, planSchema } from "@branch/shared";

export interface PlannerResult {
  plan: Plan;
  mode: "llm" | "mock" | "guild";
  model?: string;
}

// Called by the orchestrator to produce a Plan from an Issue.
//
// Resolution order:
//   1. Guild coded agent at services/agents/planner — invoked as a real
//      subprocess (`tsx src/agent.ts`) so the same code path used by
//      `guild agent deploy` is what runs locally. Stdout is the JSON plan.
//   2. Direct OpenAI-compatible call (GLM 5.1) when GUILD_PLANNER_DISABLED=1.
//   3. Canned demo plan when no credentials are available.
export async function planIssue(issue: Issue): Promise<PlannerResult> {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (process.env.GUILD_PLANNER_DISABLED !== "1") {
    const guildResult = await runGuildPlanner(issue);
    if (guildResult) return { plan: guildResult, mode: "guild", model };
  }

  if (!baseUrl || !apiKey || !model) {
    return { plan: demoPlan, mode: "mock" };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ baseURL: baseUrl, apiKey });
    const res = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(issue) },
      ],
    });
    const raw = res.choices[0]?.message.content ?? "";
    const parsed = planSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return { plan: demoPlan, mode: "mock" };
    return { plan: parsed.data, mode: "llm", model };
  } catch {
    return { plan: demoPlan, mode: "mock" };
  }
}

async function runGuildPlanner(issue: Issue): Promise<Plan | null> {
  const root = process.env.BRANCH_WORKSPACE_ROOT ?? process.cwd();
  const agentDir = path.join(root, "services", "agents", "planner");
  const entry = path.join(agentDir, "src", "agent.ts");
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(process.execPath, [
        "--no-warnings",
        "--import", "tsx/esm",
        entry,
      ], {
        cwd: agentDir,
        env: process.env,
        stdio: ["pipe", "pipe", "inherit"],
      });
    } catch {
      resolve(null);
      return;
    }
    let out = "";
    child.stdout?.on("data", (c: Buffer) => { out += c.toString("utf8"); });
    child.on("error", () => resolve(null));
    child.on("exit", (code) => {
      if (code !== 0 || !out.trim()) return resolve(null);
      try {
        const parsed = planSchema.safeParse(JSON.parse(out));
        resolve(parsed.success ? parsed.data : null);
      } catch {
        resolve(null);
      }
    });
    child.stdin?.write(JSON.stringify(issue));
    child.stdin?.end();
  });
}

const SYSTEM_PROMPT = `You are the planner agent in Branch, an autonomous feature-development system.
Given a GitHub issue, produce a JSON plan that describes the migration and code changes needed.

Return JSON matching this schema:
{
  "summary": string,
  "affectedSubgraphs": ("customers" | "orders" | "catalog")[],
  "steps": [
    { "kind": "migration" | "code" | "test" | "verify", "summary": string, "files": string[] }
  ],
  "migrationSql": string | undefined
}

Keep summaries concise. Prefer narrow, safe migrations (non-blocking, nullable columns with CHECK constraints).`;

function buildPrompt(issue: Issue): string {
  return `Repo: ${issue.repo}
Issue #${issue.number}: ${issue.title}

${issue.body}

Known subgraphs: customers, orders, catalog.
Produce the JSON plan only.`;
}
