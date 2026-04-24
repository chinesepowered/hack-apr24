import type { Issue, Plan } from './schemas.ts'

export const demoIssue: Issue = {
  number: 482,
  repo: 'acme/storefront',
  author: 'taylor',
  title: 'Add VAT support for EU customers',
  body: [
    'Our EU customers need VAT numbers captured at checkout so we can produce',
    'compliant invoices. Add a `vat_number` field on `customers` and surface it',
    'through the `customers` subgraph. Make sure existing rows remain valid.',
    '',
    'Acceptance:',
    '- Nullable `vat_number` column on `customers` (VARCHAR(32))',
    '- Format check: EU VAT regex (country prefix + 8-12 alphanumerics)',
    '- GraphQL: `Customer.vatNumber: String`',
    '- Migration is safe on a loaded table (no rewrite)',
  ].join('\n'),
}

export const demoPlan: Plan = {
  summary:
    'Add a nullable VAT number column to customers with a format check, expose it in the customers subgraph, and verify via federated query.',
  affectedSubgraphs: ['customers'],
  steps: [
    {
      kind: 'migration',
      summary: 'Add customers.vat_number column (nullable, VARCHAR(32)) with CHECK constraint',
      files: ['packages/db/migrations/0001_vat_number.sql'],
    },
    {
      kind: 'code',
      summary: 'Extend Drizzle schema and Pothos Customer type with vatNumber',
      files: [
        'packages/db/src/schema.ts',
        'services/subgraphs/customers/src/index.ts',
      ],
    },
    {
      kind: 'test',
      summary: 'Federated query returns vatNumber when set; null by default',
      files: ['services/subgraphs/customers/src/__tests__/vat.test.ts'],
    },
    {
      kind: 'verify',
      summary: 'Run query against forked preview DB and confirm response shape',
      files: [],
    },
  ],
  migrationSql: `-- 0001_vat_number.sql
ALTER TABLE customers
  ADD COLUMN vat_number VARCHAR(32);

ALTER TABLE customers
  ADD CONSTRAINT customers_vat_number_format
  CHECK (
    vat_number IS NULL
    OR vat_number ~ '^[A-Z]{2}[A-Z0-9]{8,12}$'
  );

CREATE INDEX IF NOT EXISTS customers_vat_number_idx
  ON customers (vat_number)
  WHERE vat_number IS NOT NULL;
`,
}

export const demoPrBody = `## Summary

Adds VAT number support for EU customers per issue #482.

### Changes

| File | Δ |
|---|---|
| \`packages/db/migrations/0001_vat_number.sql\` | +16 / -0 |
| \`packages/db/src/schema.ts\` | +1 / -0 |
| \`services/subgraphs/customers/src/index.ts\` | +4 / -1 |
| \`services/subgraphs/customers/src/__tests__/vat.test.ts\` | +42 / -0 |

### Migration (safe on loaded tables)

\`\`\`sql
ALTER TABLE customers ADD COLUMN vat_number VARCHAR(32);
ALTER TABLE customers ADD CONSTRAINT customers_vat_number_format
  CHECK (vat_number IS NULL OR vat_number ~ '^[A-Z]{2}[A-Z0-9]{8,12}$');
CREATE INDEX customers_vat_number_idx ON customers (vat_number)
  WHERE vat_number IS NOT NULL;
\`\`\`

### Live preview database

A Ghost fork of \`branch-prod\` was created for this PR:

\`\`\`
psql "postgres://branch:***@ghost-eu.branch.build:5432/pr-482-vat-support"
\`\`\`

Connection stays live until the PR is merged or closed.

### Verification

Federated query against the preview environment:

\`\`\`graphql
{ customer(id: "…") { id email vatNumber } }
\`\`\`

Returns \`{ vatNumber: null }\` for existing rows; accepts valid VAT numbers on update.

### Supply-chain

Preview image built with apko on a Chainguard base.
CVEs: **47 → 0** (−47) vs \`node:20\`.

🤖 Opened by Branch.
`

export const demoVerifyQuery = `query CustomerVat($id: ID!) {
  customer(id: $id) {
    id
    email
    country
    vatNumber
  }
}`
