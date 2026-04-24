"use agent";

import OpenAI from "openai";
import { z } from "zod";

// Branch planner — Guild coded agent.
//
//  • The "use agent" directive above is the Guild Babel plugin marker that
//    enables suspendable execution (state persisted across awaits, durable
//    retries) when this file is loaded by the Guild runtime.
//  • For local execution and Guild deployment we expose the canonical
//    `agent({ inputSchema, outputSchema, run })` factory as the default
//    export. The same `run` body powers the CLI mode used by the dashboard
//    orchestrator (subprocess invocation), so behaviour is identical in
//    Guild Hub and on a developer workstation.

export const inputSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string(),
  repo: z.string(),
  author: z.string(),
});

const stepSchema = z.object({
  kind: z.enum(["migration", "code", "test", "verify"]),
  summary: z.string(),
  files: z.array(z.string()).default([]),
});

// Permissive on input — different models name these fields differently —
// then we coerce to the strict shape downstream.
const looseOutputSchema = z.object({
  summary: z.string().default("Generated plan"),
  affectedSubgraphs: z.array(z.enum(["customers", "orders", "catalog"])).default([]),
  steps: z.array(stepSchema).optional(),
  migrationSql: z.string().optional(),
});

export const outputSchema = z.object({
  summary: z.string(),
  affectedSubgraphs: z.array(z.enum(["customers", "orders", "catalog"])).default([]),
  steps: z.array(stepSchema).min(1),
  migrationSql: z.string().optional(),
});

export type Issue = z.infer<typeof inputSchema>;
export type Plan = z.infer<typeof outputSchema>;

const SYSTEM = `You are the Branch planner agent. Given a GitHub issue, produce a JSON plan describing
migration + code changes across the customers/orders/catalog federated subgraphs.
Keep migrations narrow, non-blocking, and nullable where possible.`;

interface RunCtx {
  // Guild's Task surface — only what we use, typed loosely to avoid the
  // SDK as a hard dependency at type-check time.
  task?: {
    ui?: { notify: (event: unknown) => Promise<void> | void };
  };
}

export async function run(input: Issue, ctx: RunCtx = {}): Promise<Plan> {
  await notify(ctx, "Validating issue payload");
  const issue = inputSchema.parse(input);
  if (process.env.USE_MOCK_LLM === "1") {
    await notify(ctx, "Returning canned plan (USE_MOCK_LLM=1)");
    return MOCK_PLAN;
  }
  const baseURL = required("OPENAI_BASE_URL");
  const apiKey = required("OPENAI_API_KEY");
  const model = required("OPENAI_MODEL");
  await notify(ctx, `Calling ${model} via ${new URL(baseURL).host}`);
  const client = new OpenAI({ baseURL, apiKey });
  const res = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt(issue) },
    ],
  });
  const raw = res.choices[0]?.message.content ?? "{}";
  await notify(ctx, "Parsing structured plan");
  return coerce(JSON.parse(raw));
}

// Coerce model output (which is often loose on the `steps` array) into the
// strict Plan shape. Synthesises a single step from `summary`/`migrationSql`
// when the model omitted it.
function coerce(raw: unknown): Plan {
  const loose = looseOutputSchema.safeParse(raw);
  const base = loose.success
    ? loose.data
    : { summary: "Generated plan", affectedSubgraphs: [] as Plan["affectedSubgraphs"], steps: undefined, migrationSql: undefined };
  const steps =
    base.steps && base.steps.length > 0
      ? base.steps
      : [
          {
            kind: base.migrationSql ? ("migration" as const) : ("code" as const),
            summary: base.summary,
            files: [] as string[],
          },
        ];
  return outputSchema.parse({ ...base, steps });
}

async function notify(ctx: RunCtx, message: string): Promise<void> {
  const sdk = await loadGuildSdk();
  if (sdk?.progressLogNotifyEvent && ctx.task?.ui) {
    try {
      await ctx.task.ui.notify(sdk.progressLogNotifyEvent(message));
      return;
    } catch {
      // fall through
    }
  }
  process.stderr.write(`[planner] ${message}\n`);
}

interface GuildSdk {
  agent?: (def: Record<string, unknown>) => unknown;
  progressLogNotifyEvent?: (m: string) => unknown;
}

// Indirect import keeps the optional `@guildai/agents-sdk` from being a
// hard TS dependency on workstations that haven't run `guild auth login`.
async function loadGuildSdk(): Promise<GuildSdk | null> {
  try {
    const dynImport = new Function("m", "return import(m)") as (
      m: string,
    ) => Promise<GuildSdk>;
    return await dynImport("@guildai/agents-sdk");
  } catch {
    return null;
  }
}

function prompt(issue: Issue): string {
  return `Repo: ${issue.repo}\nIssue #${issue.number}: ${issue.title}\n\n${issue.body}\n\nReturn JSON only.`;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const MOCK_PLAN: Plan = {
  summary: "Add VAT number column to customers with a CHECK constraint; expose via customers subgraph.",
  affectedSubgraphs: ["customers"],
  steps: [
    { kind: "migration", summary: "ALTER TABLE customers ADD COLUMN vat_number", files: [] },
    { kind: "code", summary: "Expose Customer.vatNumber in customers subgraph", files: [] },
    { kind: "verify", summary: "Federated query returns vatNumber", files: [] },
  ],
  migrationSql: "ALTER TABLE customers ADD COLUMN vat_number VARCHAR(32);",
};

// Default export — Guild registers this when the agent is loaded by the
// runtime. We resolve the SDK lazily so a missing `@guildai/agents-sdk`
// (i.e. the dev hasn't run `guild auth login` yet) leaves the CLI path
// fully operational.
const sdkAgent = await (async () => {
  const sdk = await loadGuildSdk();
  if (!sdk || typeof sdk.agent !== "function") return null;
  return sdk.agent({
    description: "Branch planner — turns a GitHub issue into a structured Plan.",
    inputSchema,
    outputSchema,
    run,
  });
})();

export default sdkAgent ?? { description: "Branch planner (CLI fallback)", run };

// CLI entry: read issue JSON on stdin, write plan JSON to stdout.
if (process.argv[1] && process.argv[1].endsWith("agent.ts")) {
  const chunks: Buffer[] = [];
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", async () => {
    const input = Buffer.concat(chunks).toString("utf8") || '{"number":0,"title":"","body":"","repo":"","author":""}';
    const issue = inputSchema.parse(JSON.parse(input));
    const result = await run(issue);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  });
}
