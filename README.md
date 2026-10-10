# FalconCare Hub

FalconCare Hub is a multi-tenant workforce-management foundation for UK domiciliary care and supported-living providers. Sprint 1 covers authentication, organisation membership, tenant-scoped staff records, employment history, audit events, and deployment foundations. Visit scheduling, payroll, medication, AI, and WhatsApp features are intentionally out of scope.

## Stack

- Next.js App Router, React, TypeScript strict mode, Tailwind CSS
- shadcn/ui-compatible primitives, Lucide icons, React Hook Form, Zod
- Auth.js credentials authentication and JWT sessions
- PostgreSQL and Prisma ORM
- Vitest unit/API tests and Playwright browser tests

## Local development

Requirements: Node.js 22.12+, npm, and Docker with Compose.

1. Copy `.env.example` to `.env` and replace `AUTH_SECRET`, `DEV_ADMIN_PASSWORD`, and the local PostgreSQL password in both `POSTGRES_PASSWORD` and `DATABASE_URL`. For example, generate a secret with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

2. Start PostgreSQL and the local Mailpit email catcher:

   ```powershell
   docker compose up -d db mailpit
   ```

   Mailpit's inbox is available at <http://localhost:8025>.

3. Install dependencies, generate Prisma Client, apply migrations, and create fictional demo data:

   ```powershell
   npm ci
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

   The seed requires `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD` in `.env`. It refuses to run when `NODE_ENV=production`. Sample staff have `.test` email addresses and reserved fictional UK telephone numbers.

4. Start the application:

   ```powershell
   npm run dev
   ```

   Sign in using the development credentials from `.env`. Public self-registration is not available.

## Database and tenant model

The initial migration is [20261010133000_sprint1_foundation](./prisma/migrations/20261010133000_sprint1_foundation/migration.sql). Apply migrations explicitly with:

```powershell
npm run db:migrate
```

The database contains `Organisation`, `User`, `Membership`, `StaffProfile`, `EmploymentRecord`, `Invitation`, `PasswordResetToken`, `RateLimitBucket`, and `AuditLog`. Tenant-owned rows carry `organisationId`; membership, staff, employment, invitation, and audit relations include tenant-scoped composite keys where applicable. Employee numbers are unique within an organisation. Staff profiles and employment history are retained when a staff member is deactivated.

Every protected request resolves an authenticated, active membership server-side. A requested active-organisation header is accepted only when the authenticated user is an active member of that organisation. Staff and employment queries include the resolved organisation ID. Platform administrators receive no implicit tenant membership or access to staff records.

## Roles and access

- **ORG_ADMIN**: organisation settings, invitations and role assignments, staff management, and deactivation.
- **MANAGER**: create/update staff profiles and view employment history; cannot deactivate staff or manage access.
- **COORDINATOR**: view the restricted staff directory; cannot update profiles or see protected employment history.
- **CARE_WORKER**: view their own profile and update only its contact email/phone.
- **PLATFORM_ADMIN**: platform role grants organisation metadata only; it does not bypass membership or expose tenant staff data.

API writes validate same-origin requests, use Zod schemas, and create tenant-scoped audit events. Invitations and password-reset links use random single-use tokens; only SHA-256 token hashes are persisted. Passwords use bcrypt. Auth.js handles sign-in CSRF; custom cookie-authenticated writes require a matching `Origin`.

## Tests and checks

```powershell
npx playwright install chromium
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Vitest includes authentication, authorization, tenant-scoping, staff API, token, pagination, and relation-contract tests. Playwright checks the public login experience. Tests that exercise production persistence against PostgreSQL should be run in an isolated test database; no database reset is performed by the test or seed commands.

## Docker Compose

For local container deployment:

```powershell
Copy-Item .env.example .env
# Edit .env: set strong local POSTGRES_PASSWORD and AUTH_SECRET values, and keep the local password URL-safe in DATABASE_URL.
docker compose --profile release run --rm migrate
docker compose up --build -d
```

The release-profile `migrate` service runs `prisma migrate deploy` explicitly and is not part of application startup. PostgreSQL data is persisted in the named `postgres_data` volume. The application listens on port 3000 by default; `/api/health` checks database connectivity. Mailpit captures development email.

## Coolify deployment

1. Provision PostgreSQL in Coolify (or connect an existing managed PostgreSQL service). Enable persistent database storage and backups. Use a private/internal connection address where available.
2. Create a Dockerfile-based application resource pointing to this repository and `Dockerfile`. Expose container port `3000`.
3. Configure the public HTTPS domain in Coolify. Set `APP_URL` and `AUTH_URL` to that exact origin (for example, `https://care.example.co.uk`) and set `AUTH_TRUST_HOST=true`.
4. Add the production environment values below. Use a unique high-entropy `AUTH_SECRET`; do not use `.env.example` values. Configure a real SMTP relay and sender domain; do not use Mailpit for production email.
5. Before promoting a release, take a database backup and run the release operation once against the production database:

   ```sh
   npm run db:migrate
   ```

   Run it in a one-off release container/job built from the Dockerfile's `builder` target with production `DATABASE_URL`, or use the Compose `migrate` release profile. For example:

   ```sh
   docker build --target builder -t falconcare-hub-migrate .
   docker run --rm -e DATABASE_URL="$DATABASE_URL" falconcare-hub-migrate npm run db:migrate
   ```

   The production runtime image intentionally omits development tooling. Do not run `prisma migrate reset`, `db push`, or the development seed against production.
6. Deploy the application, verify `https://<your-domain>/api/health`, and confirm SMTP delivery. Keep database storage persistent. Sprint 1 does not store uploaded/private documents; if object storage is added later, use private buckets and tenant-scoped access policies.

### Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string; URL-encode special characters in credentials. |
| `AUTH_SECRET` | Yes | Auth.js signing/encryption secret; use at least 32 random bytes. |
| `APP_URL` | Yes | Canonical public application origin, used for CSRF origin checks and email links. |
| `AUTH_URL` | Recommended | Canonical Auth.js URL behind a reverse proxy. |
| `AUTH_TRUST_HOST` | Yes in Coolify | Set `true` when deployed behind Coolify's trusted proxy. |
| `SMTP_HOST` | Yes for email | SMTP host. Local Compose points to Mailpit; production must use a real provider. |
| `SMTP_PORT` | Yes for email | SMTP port. |
| `SMTP_SECURE` | Yes for email | `true` for implicit TLS, typically on port 465. |
| `SMTP_STARTTLS` | Yes for email | Set `true` to require SMTP STARTTLS, typically on port 587. |
| `SMTP_USER`, `SMTP_PASSWORD` | Provider-dependent | SMTP credentials. Keep them in the deployment secret store. |
| `EMAIL_FROM` | Yes for email | Verified sender address. |
| `NODE_ENV` | Runtime | Set to `production` in deployed environments. |
| `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` | Development only | Seed administrator credentials; password must be at least 12 characters. Never set these in production. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Local Compose only | Credentials for the local PostgreSQL container. |

## Sprint 1 scope notes

- Invitation and password-reset delivery depends on a configured SMTP server. In local Compose, messages are inspected in Mailpit.
- Memberships are resolved to the first active organisation by default. API clients may select another organisation only with `x-active-organisation` when the authenticated user has a corresponding active membership.
- Platform-level organisation provisioning, organisation deletion, user role-change administration beyond invitation assignments, and audit-log browsing are not exposed as UI workflows in this sprint.
- No care visits, scheduling, payroll, medication, AI, or WhatsApp functionality is included.
#   c a r e h u b  
 