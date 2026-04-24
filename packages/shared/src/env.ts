import { z } from 'zod'

const boolFlag = z
  .union([z.literal('0'), z.literal('1'), z.literal('true'), z.literal('false')])
  .transform((v) => v === '1' || v === 'true')
  .default('0')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  OPENAI_BASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),

  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  GITHUB_INSTALLATION_ID: z.string().optional(),
  GITHUB_DEMO_REPO: z.string().optional(),

  GUILD_API_KEY: z.string().optional(),
  GUILD_WORKSPACE_ID: z.string().optional(),

  GHOST_API_KEY: z.string().optional(),
  GHOST_BASE_DATABASE: z.string().default('branch-prod'),

  COSMO_API_KEY: z.string().optional(),
  COSMO_ROUTER_URL: z.string().url().default('http://localhost:3002/graphql'),
  COSMO_CDN_URL: z.string().optional(),

  INSFORGE_URL: z.string().url().default('http://localhost:7130'),
  INSFORGE_API_KEY: z.string().optional(),

  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_CHANNEL_ID: z.string().optional(),

  CHAINGUARD_PULL_TOKEN_USERNAME: z.string().optional(),
  CHAINGUARD_PULL_TOKEN_PASSWORD: z.string().optional(),

  NGROK_AUTHTOKEN: z.string().optional(),

  USE_MOCK_GHOST: boolFlag,
  USE_MOCK_INSFORGE: boolFlag,
  USE_MOCK_WUNDERGRAPH: boolFlag,
  USE_MOCK_GITHUB: boolFlag,
  USE_MOCK_CHAINGUARD: boolFlag,
  USE_MOCK_SLACK: boolFlag,
})

export type Env = z.infer<typeof envSchema>

let cached: Env | undefined

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached
  const parsed = envSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  cached = parsed.data
  return cached
}

export function resetEnvCache(): void {
  cached = undefined
}
