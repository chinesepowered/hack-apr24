"use agent";

// Branch executor — Guild coded agent. Given a Plan + fork connection,
// applies the migration, then defers PR creation and Chainguard image
// building to adapters wired in the main orchestrator.
//
// The "use agent" directive enables Guild's suspendable runtime when this
// file is loaded by the Guild CLI. The same `run` body powers CLI usage so
// the dashboard's subprocess invocation path is identical to Guild Hub.

import { spawn } from "node:child_process";
import { z } from "zod";

export const inputSchema = z.object({
  runId: z.string(),
  forkConnectionString: z.string(),
  migrationSql: z.string(),
  repo: z.string(),
  branch: z.string(),
});

export const outputSchema = z.object({
  migrationApplied: z.boolean(),
  prUrl: z.string().optional(),
  imageRef: z.string().optional(),
  error: z.string().optional(),
});

export type ExecuteArgs = z.infer<typeof inputSchema>;
export type ExecuteResult = z.infer<typeof outputSchema>;

interface RunCtx {
  task?: { ui?: { notify: (event: unknown) => Promise<void> | void } };
}

export async function run(input: ExecuteArgs, ctx: RunCtx = {}): Promise<ExecuteResult> {
  const args = inputSchema.parse(input);
  if (process.env.USE_MOCK_EXEC === "1") {
    await notify(ctx, "USE_MOCK_EXEC=1 — returning canned result");
    return {
      migrationApplied: true,
      prUrl: `https://github.com/${args.repo}/pull/482`,
      imageRef: `cgr.dev/branch/preview:${args.runId}`,
    };
  }
  try {
    await notify(ctx, `Applying migration to fork (${args.runId})`);
    await applyMigration(args.forkConnectionString, args.migrationSql);
    return { migrationApplied: true };
  } catch (err) {
    return {
      migrationApplied: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
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
  process.stderr.write(`[executor] ${message}\n`);
}

interface GuildSdk {
  agent?: (def: Record<string, unknown>) => unknown;
  progressLogNotifyEvent?: (m: string) => unknown;
}

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

async function applyMigration(dsn: string, sql: string): Promise<void> {
  // Minimal: spawn `psql` with the fork DSN and feed it the SQL.
  await new Promise<void>((resolve, reject) => {
    const p = spawn("psql", [dsn, "-v", "ON_ERROR_STOP=1"], {
      stdio: ["pipe", "inherit", "inherit"],
    });
    p.stdin.write(sql);
    p.stdin.end();
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`psql exited ${code}`)),
    );
    p.on("error", reject);
  });
}

// Guild SDK registration — lazy so a missing package leaves the CLI path operational.
const sdkAgent = await (async () => {
  const sdk = await loadGuildSdk();
  if (!sdk || typeof sdk.agent !== "function") return null;
  return sdk.agent({
    description: "Branch executor — applies the planned migration to a fork.",
    inputSchema,
    outputSchema,
    run,
  });
})();

export default sdkAgent ?? { description: "Branch executor (CLI fallback)", run };

if (process.argv[1] && process.argv[1].endsWith("agent.ts")) {
  const chunks: Buffer[] = [];
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", async () => {
    const input = Buffer.concat(chunks).toString("utf8");
    const args = inputSchema.parse(JSON.parse(input));
    const result = await run(args);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  });
}
