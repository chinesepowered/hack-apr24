import { type Issue, type Plan, demoPlan, planSchema } from "@branch/shared";

export interface PlannerResult {
  plan: Plan;
  mode: "llm" | "mock";
  model?: string;
}

// Called by the orchestrator to produce a Plan from an Issue.
// Uses GLM 5.1 (or any OpenAI-compatible model) when credentials are present;
// otherwise returns the canned demo plan.
export async function planIssue(issue: Issue): Promise<PlannerResult> {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    return { plan: demoPlan, mode: "mock" };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ baseURL: baseUrl, apiKey });
    const prompt = buildPrompt(issue);
    const res = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });
    const raw = res.choices[0]?.message.content ?? "";
    const parsed = planSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { plan: demoPlan, mode: "mock" };
    }
    return { plan: parsed.data, mode: "llm", model };
  } catch {
    return { plan: demoPlan, mode: "mock" };
  }
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
