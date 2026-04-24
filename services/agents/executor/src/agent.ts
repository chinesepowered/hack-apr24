"use agent";

// Guild coded-agent entry for the executor. Given a Plan + fork connection,
// applies the migration, runs federated verification, opens the PR, and
// kicks off a Chainguard apko build. The full orchestration for the demo
// lives in apps/web — this agent is the Guild-deployable equivalent.

import { spawn } from "node:child_process";

export interface ExecuteArgs {
  runId: string;
  forkConnectionString: string;
  migrationSql: string;
  repo: string;
  branch: string;
}

export interface ExecuteResult {
  migrationApplied: boolean;
  prUrl?: string;
  imageRef?: string;
  error?: string;
}

export async function execute(args: ExecuteArgs): Promise<ExecuteResult> {
  if (process.env.USE_MOCK_EXEC === "1") {
    return {
      migrationApplied: true,
      prUrl: `https://github.com/${args.repo}/pull/482`,
      imageRef: `cgr.dev/branch/preview:${args.runId}`,
    };
  }
  try {
    await applyMigration(args.forkConnectionString, args.migrationSql);
    // PR + image steps rely on adapters; wired in the main orchestrator.
    return { migrationApplied: true };
  } catch (err) {
    return {
      migrationApplied: false,
      error: err instanceof Error ? err.message : String(err),
    };
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

if (process.argv[1] && process.argv[1].endsWith("agent.ts")) {
  const chunks: Buffer[] = [];
  process.stdin.on("data", (c) => chunks.push(c));
  process.stdin.on("end", async () => {
    const input = Buffer.concat(chunks).toString("utf8");
    const args = JSON.parse(input) as ExecuteArgs;
    const result = await execute(args);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  });
}
