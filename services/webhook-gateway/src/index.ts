import { loadEnv } from '@branch/shared'
import { Webhooks } from '@octokit/webhooks'
import Fastify from 'fastify'

const env = loadEnv()
const app = Fastify({ logger: true })

const webhooks = new Webhooks({ secret: env.GITHUB_WEBHOOK_SECRET ?? 'dev-secret' })

webhooks.on('issues.opened', async ({ payload }) => {
  app.log.info({ issue: payload.issue.number, repo: payload.repository.full_name }, 'issue opened')
  // TODO: POST to Guild trigger endpoint with GUILD_API_KEY,
  // passing { repo, issueNumber, title, body } as the agent input.
})

app.post<{ Body: string }>('/github/webhook', async (req, reply) => {
  const sig = req.headers['x-hub-signature-256']
  const event = req.headers['x-github-event']
  const delivery = req.headers['x-github-delivery']
  if (
    typeof sig !== 'string' ||
    typeof event !== 'string' ||
    typeof delivery !== 'string'
  ) {
    return reply.code(400).send({ error: 'missing github headers' })
  }
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
  try {
    await webhooks.verifyAndReceive({ id: delivery, name: event as 'issues', signature: sig, payload: raw })
    return reply.send({ ok: true })
  } catch (err) {
    app.log.error({ err }, 'invalid webhook signature')
    return reply.code(401).send({ error: 'invalid signature' })
  }
})

app.get('/health', async () => ({ ok: true }))

const port = Number(process.env.PORT ?? 8787)
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
