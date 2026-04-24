import { z } from 'zod'

export const issueSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  body: z.string(),
  repo: z.string(),
  author: z.string(),
})
export type Issue = z.infer<typeof issueSchema>

export const planStepSchema = z.object({
  kind: z.enum(['migration', 'code', 'test', 'verify']),
  summary: z.string(),
  files: z.array(z.string()).default([]),
})

export const planSchema = z.object({
  summary: z.string(),
  affectedSubgraphs: z.array(z.enum(['customers', 'orders', 'catalog'])).default([]),
  steps: z.array(planStepSchema).min(1),
  migrationSql: z.string().optional(),
})
export type Plan = z.infer<typeof planSchema>

export const runStatusSchema = z.enum([
  'queued',
  'planning',
  'forking',
  'migrating',
  'verifying',
  'opening_pr',
  'building_image',
  'succeeded',
  'failed',
])
export type RunStatus = z.infer<typeof runStatusSchema>

export const phaseSchema = z.enum([
  'plan',
  'fork',
  'migrate',
  'verify',
  'pr',
  'image',
])
export type Phase = z.infer<typeof phaseSchema>

const baseEvent = z.object({
  runId: z.string(),
  ts: z.string().datetime(),
  seq: z.number().int(),
})

export const runEventSchema = z.discriminatedUnion('kind', [
  baseEvent.extend({ kind: z.literal('run_started'), issue: issueSchema }),
  baseEvent.extend({ kind: z.literal('phase_started'), phase: phaseSchema, label: z.string() }),
  baseEvent.extend({
    kind: z.literal('phase_completed'),
    phase: phaseSchema,
    durationMs: z.number(),
  }),
  baseEvent.extend({
    kind: z.literal('log'),
    phase: phaseSchema,
    level: z.enum(['info', 'warn', 'error']).default('info'),
    message: z.string(),
  }),
  baseEvent.extend({ kind: z.literal('plan_generated'), plan: planSchema }),
  baseEvent.extend({
    kind: z.literal('fork_ready'),
    fork: z.object({
      id: z.string(),
      name: z.string(),
      connectionString: z.string(),
      readOnlyConnectionString: z.string().optional(),
      sizeBytes: z.number().optional(),
      rowsCopied: z.number().optional(),
    }),
  }),
  baseEvent.extend({
    kind: z.literal('migration_applied'),
    sql: z.string(),
    statementCount: z.number(),
  }),
  baseEvent.extend({
    kind: z.literal('verification_result'),
    query: z.string(),
    before: z.unknown().optional(),
    after: z.unknown(),
    ok: z.boolean(),
  }),
  baseEvent.extend({
    kind: z.literal('pr_opened'),
    pr: z.object({
      number: z.number(),
      url: z.string(),
      branch: z.string(),
      title: z.string(),
      body: z.string(),
      filesChanged: z.number(),
      additions: z.number(),
      deletions: z.number(),
    }),
  }),
  baseEvent.extend({
    kind: z.literal('image_built'),
    image: z.object({
      ref: z.string(),
      digest: z.string(),
      sizeBytes: z.number(),
      cve: z.object({ vanilla: z.number(), chainguard: z.number(), delta: z.number() }),
    }),
  }),
  baseEvent.extend({
    kind: z.literal('run_completed'),
    status: z.enum(['succeeded', 'failed']),
    summary: z.string(),
  }),
])
export type RunEvent = z.infer<typeof runEventSchema>

export const traceEventSchema = z.object({
  runId: z.string(),
  ts: z.string().datetime(),
  phase: runStatusSchema,
  message: z.string(),
  data: z.record(z.unknown()).optional(),
})
export type TraceEvent = z.infer<typeof traceEventSchema>

export const runSchema = z.object({
  id: z.string(),
  issue: issueSchema,
  status: runStatusSchema,
  plan: planSchema.optional(),
  forkConnString: z.string().optional(),
  prUrl: z.string().url().optional(),
  previewImageRef: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Run = z.infer<typeof runSchema>
