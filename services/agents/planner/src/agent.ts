"use agent";

import OpenAI from "openai";
import { z } from "zod";

// Guild coded-agent entry. When deployed via `guild agent deploy`, the
// `"use agent"` directive switches execution context; otherwise runs as a
// plain Node process. Both modes call GLM 5.1 via the OpenAI-compatible API.

const issueSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string(),
  repo: z.string(),
  author: z.string(),
});

const planSchema = z.object({
  summary: z.string(),
  affectedSubgraphs: z.array(z.enum(["customers", "orders", "catalog"])).default([]),
  steps: z
    .array(
      z.object({
        kind: z.enum(["migration", "code", "test", "verify"]),
        summary: z.string(),
        files: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  migrationSql: z.string().optional(),
});

export type Issue = z.infer<typeof issueSchema>;
export type Plan = z.infer<typeof planSchema>;

const SYSTEM = `You are the Branch planner agent. Given a GitHub issue, produce a JSON plan describing
migration + code changes across the customers/orders/catalog federated subgraphs.
Keep migrations narrow, non-blocking, and nullable where possible.`;

export async function plan(issue: Issue): Promise<Plan> {
  if (process.env.USE_MOCK_LLM === "1") return MOCK_PLAN;
  const baseURL = required("OPENAI_BASE_URL");
  const apiKey = required("OPENAI_API_KEY");
  const model = required("OPENAI_MODEL");

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
  return planSchema.parse(JSON.parse(raw));
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

// CLI entry: read issue JSON on stdin, write plan JSON to stdout.
if (process.argv[1] && process.argv[1].endsWith("agent.ts")) {
  const chunks: Buffer[] = [];
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", async () => {
    const input = Buffer.concat(chunks).toString("utf8") || '{"number":0,"title":"","body":"","repo":"","author":""}';
    const issue = issueSchema.parse(JSON.parse(input));
    const result = await plan(issue);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  });
}
