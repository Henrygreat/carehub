# FalconCare Hub

FalconCare Hub is a multi-tenant workforce-management foundation for UK domiciliary care and supported-living providers. Sprint 1 covers authentication, organisation membership, tenant-scoped staff records, employment history, audit events, and deployment foundations. Visit scheduling, payroll, medication, AI, and WhatsApp features are intentionally out of scope.

## Stack

- Next.js App Router, React, TypeScript strict mode, Tailwind CSS
- shadcn/ui-compatible primitives, Lucide icons, React Hook Form, Zod
- Auth.js credentials authentication and JWT sessions
- PostgreSQL and Prisma ORM
- Vitest unit/API tests and Playwright browser tests

## Local development

Requirements: Node.js 22.12+ and npm 10.9.4 (pinned through `packageManager` and used in Docker). PostgreSQL is needed only to run the application against persisted data, apply migrations, or seed demo records; schema validation, Prisma Client generation, type-checking, tests, linting and production compilation do not need PostgreSQL.

1. Copy `.env.example` to `.env`. Its `DATABASE_URL` is a clearly marked, non-functional placeholder used only by Prisma generation/validation/formatting. **Do not use it for migrations, seeding, or application runtime.** Local compilation does not require production values such as `AUTH_SECRET`, `APP_URL`, `RESEND_API_KEY` or `EMAIL_FROM`. Configure real runtime values when exercising authentication or email features. For example, generate a secret with:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

2. Validate and build offline (no database connection is made):

   ```powershell
   npx --yes npm@10.9.4 ci
   npm run prisma:validate
   npm run prisma:generate
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

   `prisma:generate`, `prisma:validate` and Prisma formatting use the internal placeholder only when no real `DATABASE_URL` is set. All database operations reject that placeholder before invoking Prisma.

3. To run the database-backed application locally, set a real PostgreSQL `DATABASE_URL`, then start PostgreSQL:

   ```powershell
   docker compose up -d db
   ```

   To preview the invitation and password-reset designs without sending email or using real staff information, start the app in development and open <http://localhost:3000/dev/email-preview>. That page uses fictional data and nonfunctional preview-only links.

4. Apply migrations and create fictional demo data:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

   The seed requires `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD` in `.env`. It refuses to run when `NODE_ENV=production`. Sample staff have `.test` email addresses and reserved fictional UK telephone numbers.

5. Start the application:

   ```powershell
   npm run dev
   ```

   Sign in using the development credentials from `.env`. Public self-registration is not available. Sending actual transactional emails requires a valid Resend API key and verified sender.

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

API writes validate same-origin requests, use Zod schemas, and create tenant-scoped audit events. Invitations and password-reset links use random single-use tokens; only SHA-256 token hashes are persisted. Passwords use bcrypt. Transactional invitation and reset emails are sent with the official Resend Node SDK from server-only code. Auth.js handles sign-in CSRF; custom cookie-authenticated writes require a matching `Origin`.

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

For local container deployment with PostgreSQL:

```powershell
Copy-Item .env.example .env
# Edit .env: set a strong local POSTGRES_PASSWORD and AUTH_SECRET; set RESEND_API_KEY for delivery and use a verified sender in EMAIL_FROM. Compose constructs its real database URL from the POSTGRES_* values.
docker compose --profile release run --rm migrate
docker compose up --build -d
```

The release-profile `migrate` service runs `prisma migrate deploy` explicitly and is not part of application startup. PostgreSQL data is persisted in the named `postgres_data` volume. The application listens on port 3000 by default; `/api/health` checks database connectivity. Local HTML email previews are available at `/dev/email-preview` while running the Next.js development server; they never call Resend and contain no real staff information.

## Coolify deployment

1. Provision PostgreSQL in Coolify (or connect an existing managed PostgreSQL service). Enable persistent database storage and backups. Use a private/internal connection address where available.
2. Create a Dockerfile-based application resource pointing to this repository and `Dockerfile`. Expose container port `3000`.
3. Configure the public HTTPS domain in Coolify. Set `APP_URL` and `AUTH_URL` to that exact origin (for example, `https://care.example.co.uk`) and set `AUTH_TRUST_HOST=true`.
4. Add the production environment values below in Coolify's runtime environment/secret settings. Do not configure `AUTH_SECRET`, `AUTH_URL`, `RESEND_API_KEY` or other credentials as Docker build arguments; the Dockerfile does not use these values during image construction. Use a unique high-entropy `AUTH_SECRET`; do not use `.env.example` values. Create a Resend API key and verify the sender domain in Resend. Publish the SPF and DKIM DNS records Resend provides, wait for domain verification, and set `EMAIL_FROM` to an address on that verified domain. Keep the Resend key in Coolify's secret environment settings.
5. Before promoting a release, take a database backup and run the release operation once against the production database:

   ```sh
   npm run db:migrate
   ```

   Run it in a one-off release container/job built from the Dockerfile's `builder` target with production `DATABASE_URL`, or use the Compose `migrate` release profile. Coolify must inject the real PostgreSQL URL into that release job; do not pass the `.env.example` placeholder or inherit local `.env` values. Authentication and email secrets are needed by the running application, not by the migration job. For example:

   ```sh
   docker build --target builder -t falconcare-hub-migrate .
   docker run --rm -e DATABASE_URL="$DATABASE_URL" falconcare-hub-migrate npm run db:migrate
   ```

   The production runtime image intentionally omits development tooling. Do not run `prisma migrate reset`, `db push`, or the development seed against production.
6. Deploy the application, verify `https://<your-domain>/api/health`, and confirm Resend delivery using a controlled test mailbox. Keep database storage persistent. Sprint 1 does not store uploaded/private documents; if object storage is added later, use private buckets and tenant-scoped access policies.

### Create the first administrator (one-time)

Production starts with no users: the development seed refuses to run when `NODE_ENV=production`, and there is no default account or public registration. Create the first `ORG_ADMIN` once, after migrations have been applied (`/api/health` must report `ok`).

In Coolify, open the application, choose **Terminal**, select the running app container, and run:

```sh
node scripts/bootstrap-admin.mjs
```

The script prompts for the administrator's email, full name and password (hidden, with confirmation). To avoid prompts, set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` and `BOOTSTRAP_ADMIN_PASSWORD` for that one command instead, and never save the password in Coolify's stored environment variables:

```sh
BOOTSTRAP_ADMIN_EMAIL='you@example.co.uk' BOOTSTRAP_ADMIN_NAME='Your Name' BOOTSTRAP_ADMIN_PASSWORD='a-long-unique-passphrase' node scripts/bootstrap-admin.mjs
```

Optional `BOOTSTRAP_ORG_NAME` (default `Falcon Carers`) and `BOOTSTRAP_ORG_SLUG` (default `falcon-carers`) select the organisation. The script creates the organisation if the slug does not exist, creates the user, links them with the `ORG_ADMIN` role, and records an audit event. It only inserts data, and it stops without changes if the email already exists or the organisation already has an administrator, so it cannot overwrite accounts or be reused to add a second administrator. It never prints the password. Passwords must be 12-128 characters.

Then open `https://<your-domain>/login` and sign in with that email and password. Further users are added from **Settings → Users** through invitations. Locally, with a real `DATABASE_URL` in `.env`, use `npm run db:bootstrap-admin`.

### Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Yes at runtime/database operations | Real PostgreSQL connection string; URL-encode special characters in credentials. Placeholder is allowed only for Prisma generation/validation/formatting. |
| `AUTH_SECRET` | Yes when authentication runs | Auth.js signing/encryption secret; use at least 32 random bytes. |
| `APP_URL` | Yes when origin checks or email links are used | Canonical public application origin, used for CSRF origin checks and email links. |
| `AUTH_URL` | Recommended | Canonical Auth.js URL behind a reverse proxy. |
| `AUTH_TRUST_HOST` | Yes in Coolify | Set `true` when deployed behind Coolify's trusted proxy. |
| `RESEND_API_KEY` | Yes for email delivery | Resend API key. Server-only secret; never expose it through a `NEXT_PUBLIC_` variable or client component. |
| `EMAIL_FROM` | Yes for email delivery | Sender identity on a domain verified in Resend, for example `FalconCare Hub <notifications@care.example.co.uk>`. |
| `NODE_ENV` | Runtime | Set to `production` in deployed environments. |
| `DEV_ADMIN_EMAIL`, `DEV_ADMIN_PASSWORD` | Development only | Seed administrator credentials; password must be at least 12 characters. Never set these in production. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Local Compose only | Credentials for the local PostgreSQL container. |

## Sprint 1 scope notes

- Invitation and password-reset delivery requires a configured Resend key and verified sender. The development preview page displays branded examples with synthetic data and never sends email.
- Memberships are resolved to the first active organisation by default. API clients may select another organisation only with `x-active-organisation` when the authenticated user has a corresponding active membership.
- Platform-level organisation provisioning, organisation deletion, user role-change administration beyond invitation assignments, and audit-log browsing are not exposed as UI workflows in this sprint.
- No care visits, scheduling, payroll, medication, AI, or WhatsApp functionality is included.
