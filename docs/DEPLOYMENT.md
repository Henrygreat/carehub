# EnCare Deployment and Rollback Procedures

**Version:** 1.0
**Last Updated:** 2026-10-22
**Deployment Platform:** Coolify with Docker

---

## Table of Contents

1. [Deployment Architecture](#deployment-architecture)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Standard Deployment](#standard-deployment)
4. [Database Migration Deployment](#database-migration-deployment)
5. [Rollback Procedures](#rollback-procedures)
6. [Emergency Procedures](#emergency-procedures)
7. [Post-Deployment Verification](#post-deployment-verification)

---

## Deployment Architecture

### Components

```
┌─────────────────────────────────────────────────────────┐
│                     Coolify Platform                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐     ┌─────────────┐     ┌───────────┐  │
│  │   Traefik   │────▶│  Next.js    │────▶│ PostgreSQL│  │
│  │   (Proxy)   │     │  App:3000   │     │  DB:5432  │  │
│  └─────────────┘     └─────────────┘     └───────────┘  │
│                            │                     │       │
│                            ▼                     ▼       │
│                      ┌──────────┐         ┌──────────┐  │
│                      │  Resend  │         │  Backup  │  │
│                      │  (Email) │         │  Volume  │  │
│                      └──────────┘         └──────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Git Branch Strategy

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production code | Production |
| `staging` | Pre-production testing | Staging (if configured) |
| Feature branches | Development | Local only |

---

## Pre-Deployment Checklist

### Before Every Deployment

- [ ] All tests pass locally: `npm test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Linting passes: `npm run lint`
- [ ] Production build succeeds: `npm run build`
- [ ] Code reviewed and approved (PR merged)
- [ ] Database backup completed (if migrations present)
- [ ] Deployment window communicated to users (if breaking changes)

### Additional Checks for Migration Deployments

- [ ] Migration SQL reviewed for safety
- [ ] Migration tested in staging/development
- [ ] Rollback migration prepared (if applicable)
- [ ] Database backup verified and accessible
- [ ] Estimated downtime communicated

### Environment Variables Verified

```bash
# Required for production
DATABASE_URL          # PostgreSQL connection string
AUTH_SECRET           # NextAuth secret (min 32 chars)
AUTH_URL              # Public application URL
AUTH_TRUST_HOST       # "true" for reverse proxy
APP_URL               # Application URL for emails
RESEND_API_KEY        # Email service API key
EMAIL_FROM            # Sender email address
NODE_ENV              # "production"
```

---

## Standard Deployment

### Method 1: Coolify Auto-Deploy (Recommended)

Coolify watches the `main` branch and auto-deploys on push.

1. **Merge PR to main**:
   ```bash
   git checkout main
   git pull origin main
   git merge feature-branch
   git push origin main
   ```

2. **Monitor deployment in Coolify**:
   - Navigate to application in Coolify dashboard
   - Watch build logs
   - Verify deployment completes

3. **Verify deployment**:
   ```bash
   curl https://app.myencare.com/api/health
   # Expected: {"status":"ok"}
   ```

### Method 2: Manual Coolify Deploy

1. **Access Coolify Dashboard**
2. Navigate to **Applications > EnCare**
3. Click **Deploy** button
4. Select branch: `main`
5. Monitor build progress
6. Verify health check passes

### Method 3: Docker Compose (Development/Staging)

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose down
docker compose build --no-cache web
docker compose up -d

# Verify
curl http://localhost:3000/api/health
```

### Deployment Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| Build | 2-5 min | Docker image build |
| Deploy | 30 sec | Container replacement |
| Health Check | 30 sec | Verify app responds |
| **Total** | **3-6 min** | Standard deployment |

---

## Database Migration Deployment

### When Migrations Are Needed

Migrations are required when:
- New tables added
- Columns added/removed
- Indexes changed
- Enum values added

### Migration Deployment Steps

#### Step 1: Pre-Migration Backup

```bash
# Access Coolify terminal for PostgreSQL
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -F c -f /backups/pre_migration_${BACKUP_DATE}.dump

# Verify backup
pg_restore --list /backups/pre_migration_${BACKUP_DATE}.dump | head -10
```

#### Step 2: Check Migration Status

```bash
# In application container
npm run db:status
```

Expected output:
```
Prisma Migrate: X pending migration(s)
- 20261022120000_phase6_hybrid_onboarding (pending)
```

#### Step 3: Apply Migration

**IMPORTANT:** Migrations are NOT automatic. They must be explicitly run.

```bash
# In Coolify terminal or application container
CONFIRM_DB_BACKUP=yes npm run db:migrate
```

Expected output:
```
✔ Database backup confirmed
Applying migrations...
✔ 1 migration applied successfully
```

#### Step 4: Deploy Application Code

After migrations are applied:

1. Push code changes (if not already done)
2. Coolify auto-deploys OR manually trigger deploy
3. New code runs against updated schema

#### Step 5: Verify

```bash
# Check migration status
npm run db:status
# Expected: No pending migrations

# Check application health
curl https://app.myencare.com/api/health
# Expected: {"status":"ok"}
```

### Migration Safety Rules

| Rule | Description |
|------|-------------|
| Never drop columns | Always add new columns, deprecate old ones |
| Add nullable columns | New columns should be nullable or have defaults |
| Avoid data transforms | Complex data migrations should be separate scripts |
| Test in staging first | Always test migrations before production |
| Keep migrations small | One logical change per migration |

---

## Rollback Procedures

### Rollback Decision Matrix

| Scenario | Action |
|----------|--------|
| Broken feature, no migration | Code rollback only |
| Migration failed mid-way | Database restore + code rollback |
| Migration succeeded but app broken | Assess if reverse migration possible |
| Critical security issue | Immediate rollback + investigation |

### Method 1: Code-Only Rollback (No Migration)

When the issue is code-only and no database changes were made.

```bash
# 1. Identify last working commit
git log --oneline -10

# 2. Create rollback branch
git checkout -b rollback/issue-description
git reset --hard <last-working-commit>
git push origin rollback/issue-description

# 3. In Coolify: Deploy the rollback branch
# OR: Revert in main and push
git checkout main
git revert HEAD
git push origin main
```

### Method 2: Database Restore + Code Rollback

When a migration was applied and needs to be undone.

**IMPORTANT:** This results in data loss for any data created after the migration.

```bash
# 1. Stop application to prevent further data changes
# In Coolify: Stop the application service

# 2. Identify pre-migration backup
ls -la /backups/pre_migration_*.dump

# 3. Restore database
pg_restore -U $POSTGRES_USER -d $POSTGRES_DB \
  --clean --if-exists \
  /backups/pre_migration_YYYYMMDD_HHMMSS.dump

# 4. Rollback code
git checkout main
git reset --hard <pre-migration-commit>
git push --force origin main  # DANGEROUS: Only in emergency

# 5. Redeploy application
# Coolify will auto-deploy or manually trigger

# 6. Verify
curl https://app.myencare.com/api/health
```

### Method 3: Reverse Migration (Prisma)

If Prisma supports the reverse operation and no data loss is acceptable:

```bash
# Check if migration can be rolled back
npx prisma migrate resolve --rolled-back <migration_name>

# This marks the migration as rolled back
# You must then manually revert any schema changes
```

**Note:** Prisma does not auto-generate down migrations. Manual SQL may be required.

### Rollback Verification Checklist

- [ ] Application health check passes
- [ ] Login functionality works
- [ ] Key workflows tested (create client, view staff)
- [ ] No console errors in browser
- [ ] Database record counts match pre-incident

---

## Emergency Procedures

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 - Critical | App down, no workaround | Immediate |
| P2 - High | Major feature broken | < 1 hour |
| P3 - Medium | Minor feature broken | < 4 hours |
| P4 - Low | Cosmetic/minor | Next business day |

### P1: Application Down

1. **Verify outage**:
   ```bash
   curl -I https://app.myencare.com/api/health
   ```

2. **Check Coolify status**:
   - Application container running?
   - Database container running?
   - Recent deployment?

3. **Check application logs**:
   ```bash
   # In Coolify: View application logs
   # Look for startup errors, database connection issues
   ```

4. **Quick fixes**:
   - Restart application container
   - Check DATABASE_URL is correct
   - Check AUTH_SECRET is set

5. **If recent deployment**: Initiate rollback (Method 1 or 2)

6. **Escalate** if not resolved in 15 minutes

### P1: Database Down

1. **Check PostgreSQL container**:
   ```bash
   docker ps | grep postgres
   ```

2. **Check database logs**:
   ```bash
   docker logs encare-db --tail 100
   ```

3. **Try restart**:
   ```bash
   docker restart encare-db
   ```

4. **If disk full**: Free space or expand volume

5. **If corrupted**: Restore from backup (see BACKUP_RESTORE.md)

### Communication Template

```
Subject: [EnCare] Service Incident - [DATE]

Status: [Investigating | Identified | Monitoring | Resolved]

Impact: [Description of user impact]

Timeline:
- HH:MM UTC: Issue first reported
- HH:MM UTC: Investigation started
- HH:MM UTC: [Current status]

Next Update: HH:MM UTC

Actions:
- [What is being done]
```

---

## Post-Deployment Verification

### Automated Checks

```bash
#!/bin/bash
# post_deploy_verify.sh

APP_URL="https://app.myencare.com"

echo "=== Post-Deployment Verification ==="

# 1. Health check
echo -n "Health check: "
HEALTH=$(curl -s "${APP_URL}/api/health")
if [[ "$HEALTH" == *"ok"* ]]; then
  echo "PASS"
else
  echo "FAIL - $HEALTH"
  exit 1
fi

# 2. Login page loads
echo -n "Login page: "
LOGIN=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/login")
if [[ "$LOGIN" == "200" ]]; then
  echo "PASS"
else
  echo "FAIL - HTTP $LOGIN"
  exit 1
fi

# 3. API responds
echo -n "API response: "
API=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/v1/me")
if [[ "$API" == "401" ]]; then
  echo "PASS (401 expected for unauthenticated)"
else
  echo "FAIL - HTTP $API"
  exit 1
fi

echo "=== All checks passed ==="
```

### Manual Verification Checklist

After each production deployment:

- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Login page loads without errors
- [ ] Can log in with test account
- [ ] Dashboard loads correctly
- [ ] Staff directory displays data
- [ ] Client directory displays data
- [ ] No JavaScript console errors
- [ ] No server errors in logs (5xx)

### Smoke Test Workflow

1. Log in as Org Admin
2. Navigate to Staff directory
3. Create a new staff member
4. Navigate to Clients
5. Create a new client
6. Navigate to Rota
7. Verify calendar loads
8. Log out

---

## Appendix: Useful Commands

### Coolify CLI

```bash
# View application status
coolify app:status encare

# View logs
coolify app:logs encare --tail 100

# Restart application
coolify app:restart encare

# Force redeploy
coolify app:deploy encare --force
```

### Docker Commands

```bash
# View running containers
docker ps

# View logs
docker logs encare-web --tail 100 --follow

# Execute command in container
docker exec -it encare-web sh

# View resource usage
docker stats encare-web encare-db
```

### Database Commands

```bash
# Connect to database
docker exec -it encare-db psql -U falconcare -d falconcare

# Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'falconcare';

# Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-10-22 | Initial documentation |
