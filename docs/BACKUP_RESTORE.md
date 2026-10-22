# EnCare Database Backup and Restore Procedures

**Version:** 1.0
**Last Updated:** 2026-10-22
**Environment:** PostgreSQL 17, Coolify/Docker

---

## Table of Contents

1. [Overview](#overview)
2. [Backup Procedures](#backup-procedures)
3. [Restore Procedures](#restore-procedures)
4. [Automated Backup Schedule](#automated-backup-schedule)
5. [Backup Verification](#backup-verification)
6. [Emergency Recovery](#emergency-recovery)
7. [Test Restore Procedure](#test-restore-procedure)

---

## Overview

### Database Details

| Setting | Value |
|---------|-------|
| Database Engine | PostgreSQL 17 (Alpine) |
| Database Name | `falconcare` (configurable via `POSTGRES_DB`) |
| Schema | `public` |
| Deployment | Docker container via Coolify |
| Data Volume | `postgres_data` Docker volume |

### Backup Strategy

- **Full backups**: Daily at 02:00 UTC
- **Retention**: 30 days
- **Storage**: Offsite encrypted storage (configure per deployment)
- **Format**: `pg_dump` custom format (compressed)

---

## Backup Procedures

### Pre-Backup Checklist

- [ ] Verify database is healthy: `pg_isready`
- [ ] Check available disk space for backup file
- [ ] Verify backup storage location is accessible
- [ ] Note current migration version

### Method 1: Coolify Terminal (Recommended for Production)

1. **Access Coolify dashboard** and navigate to the PostgreSQL resource

2. **Open terminal** in the database container

3. **Create backup with timestamp**:
   ```bash
   # Set variables
   BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_FILE="encare_backup_${BACKUP_DATE}.dump"

   # Create backup (custom format, compressed)
   pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -F c -f /tmp/${BACKUP_FILE}

   # Verify backup was created
   ls -lh /tmp/${BACKUP_FILE}
   ```

4. **Copy backup to persistent storage**:
   ```bash
   # Copy to mounted volume or download via Coolify
   cp /tmp/${BACKUP_FILE} /backups/
   ```

5. **Verify backup integrity**:
   ```bash
   pg_restore --list /tmp/${BACKUP_FILE} | head -20
   ```

### Method 2: Docker Compose (Local/Development)

```bash
# From project root
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
docker compose exec db pg_dump \
  -U ${POSTGRES_USER:-falconcare} \
  -d ${POSTGRES_DB:-falconcare} \
  -F c \
  > ./backups/encare_backup_${BACKUP_DATE}.dump

# Verify file size
ls -lh ./backups/encare_backup_${BACKUP_DATE}.dump
```

### Method 3: External Connection (pg_dump from Client)

```bash
# Requires DATABASE_URL or connection details
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)

pg_dump "${DATABASE_URL}" \
  -F c \
  -f ./backups/encare_backup_${BACKUP_DATE}.dump
```

### Backup Naming Convention

```
encare_backup_YYYYMMDD_HHMMSS.dump
```

Example: `encare_backup_20261022_140530.dump`

### Backup Contents

The backup includes:
- All tables (28 tables)
- All data (users, organisations, clients, staff, visits, etc.)
- Indexes
- Constraints
- Sequences

The backup does NOT include:
- PostgreSQL roles/users (handled by Coolify)
- Database creation commands (database must exist)

---

## Restore Procedures

### Pre-Restore Checklist

- [ ] **CRITICAL**: Confirm this is the correct backup file
- [ ] **CRITICAL**: Confirm target environment (NEVER restore to production accidentally)
- [ ] Verify backup file integrity
- [ ] Stop application to prevent data conflicts
- [ ] Notify affected users of maintenance window
- [ ] Document current state before restore

### Method 1: Full Restore (Replace All Data)

**WARNING**: This will DELETE all existing data in the target database.

1. **Stop the application**:
   ```bash
   # Coolify: Use dashboard to stop the app service
   # Docker Compose:
   docker compose stop web
   ```

2. **Verify backup before restore**:
   ```bash
   pg_restore --list backup_file.dump | head -50
   ```

3. **Restore database**:
   ```bash
   # Drop and recreate (DESTRUCTIVE)
   docker compose exec db psql -U $POSTGRES_USER -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
   docker compose exec db psql -U $POSTGRES_USER -c "CREATE DATABASE ${POSTGRES_DB};"

   # Restore from backup
   docker compose exec -T db pg_restore \
     -U ${POSTGRES_USER:-falconcare} \
     -d ${POSTGRES_DB:-falconcare} \
     --clean \
     --if-exists \
     < ./backups/backup_file.dump
   ```

4. **Verify restore**:
   ```bash
   docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB \
     -c "SELECT COUNT(*) FROM organisations;"
   docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB \
     -c "SELECT COUNT(*) FROM users;"
   ```

5. **Restart application**:
   ```bash
   docker compose start web
   ```

6. **Verify application health**:
   ```bash
   curl http://localhost:3000/api/health
   # Expected: {"status":"ok"}
   ```

### Method 2: Selective Table Restore

For restoring specific tables without affecting others:

```bash
# List tables in backup
pg_restore --list backup_file.dump | grep "TABLE DATA"

# Restore specific table
pg_restore \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  --data-only \
  --table=audit_logs \
  backup_file.dump
```

### Method 3: Point-in-Time Restore to Test Environment

For testing a backup before production restore:

```bash
# Create test database
docker compose exec db psql -U $POSTGRES_USER \
  -c "CREATE DATABASE encare_restore_test;"

# Restore to test database
docker compose exec -T db pg_restore \
  -U ${POSTGRES_USER} \
  -d encare_restore_test \
  < ./backups/backup_file.dump

# Verify data
docker compose exec db psql -U $POSTGRES_USER -d encare_restore_test \
  -c "SELECT COUNT(*) FROM organisations;"

# Clean up test database when done
docker compose exec db psql -U $POSTGRES_USER \
  -c "DROP DATABASE encare_restore_test;"
```

---

## Automated Backup Schedule

### Cron Configuration (Linux Server)

Add to crontab (`crontab -e`):

```cron
# EnCare daily backup at 02:00 UTC
0 2 * * * /opt/encare/scripts/backup.sh >> /var/log/encare-backup.log 2>&1

# Cleanup backups older than 30 days at 03:00 UTC
0 3 * * * find /opt/encare/backups -name "encare_backup_*.dump" -mtime +30 -delete
```

### Backup Script (`/opt/encare/scripts/backup.sh`)

```bash
#!/bin/bash
set -e

BACKUP_DIR="/opt/encare/backups"
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/encare_backup_${BACKUP_DATE}.dump"

# Load environment
source /opt/encare/.env

echo "[$(date)] Starting EnCare backup..."

# Create backup
docker compose -f /opt/encare/docker-compose.yml exec -T db pg_dump \
  -U ${POSTGRES_USER} \
  -d ${POSTGRES_DB} \
  -F c \
  > ${BACKUP_FILE}

# Verify backup
if [ -s "${BACKUP_FILE}" ]; then
  BACKUP_SIZE=$(ls -lh ${BACKUP_FILE} | awk '{print $5}')
  echo "[$(date)] Backup completed: ${BACKUP_FILE} (${BACKUP_SIZE})"

  # Optional: Upload to offsite storage
  # aws s3 cp ${BACKUP_FILE} s3://encare-backups/

  exit 0
else
  echo "[$(date)] ERROR: Backup file is empty or missing"
  exit 1
fi
```

### Coolify Scheduled Tasks

If using Coolify's built-in scheduler:

1. Navigate to **Settings > Scheduled Tasks**
2. Add new task:
   - **Name**: EnCare Daily Backup
   - **Schedule**: `0 2 * * *`
   - **Command**: `docker exec encare-db pg_dump -U falconcare -d falconcare -F c > /backups/encare_$(date +%Y%m%d).dump`

---

## Backup Verification

### Daily Verification Checklist

Run after each automated backup:

```bash
#!/bin/bash
# verify_backup.sh

LATEST_BACKUP=$(ls -t /opt/encare/backups/*.dump | head -1)

echo "Latest backup: ${LATEST_BACKUP}"

# Check file exists and has content
if [ ! -s "${LATEST_BACKUP}" ]; then
  echo "ERROR: Backup file is missing or empty"
  exit 1
fi

# Check backup is valid pg_dump format
if ! pg_restore --list "${LATEST_BACKUP}" > /dev/null 2>&1; then
  echo "ERROR: Backup file is corrupted or invalid"
  exit 1
fi

# Count tables in backup
TABLE_COUNT=$(pg_restore --list "${LATEST_BACKUP}" | grep "TABLE DATA" | wc -l)
echo "Tables in backup: ${TABLE_COUNT}"

if [ "${TABLE_COUNT}" -lt 20 ]; then
  echo "WARNING: Fewer tables than expected (expected ~28)"
fi

# Get backup size
BACKUP_SIZE=$(ls -lh "${LATEST_BACKUP}" | awk '{print $5}')
echo "Backup size: ${BACKUP_SIZE}"

echo "Backup verification: PASSED"
```

### Monthly Restore Test

**Procedure:**

1. Create isolated test environment
2. Restore latest backup
3. Verify data integrity
4. Document results
5. Destroy test environment

```bash
# Monthly restore test script
#!/bin/bash
set -e

TEST_DB="encare_monthly_test"
LATEST_BACKUP=$(ls -t /opt/encare/backups/*.dump | head -1)

echo "Testing restore of: ${LATEST_BACKUP}"

# Create test database
docker compose exec db psql -U $POSTGRES_USER \
  -c "DROP DATABASE IF EXISTS ${TEST_DB};"
docker compose exec db psql -U $POSTGRES_USER \
  -c "CREATE DATABASE ${TEST_DB};"

# Restore
docker compose exec -T db pg_restore \
  -U ${POSTGRES_USER} \
  -d ${TEST_DB} \
  < ${LATEST_BACKUP}

# Verify record counts
echo "=== Restore Verification ==="
docker compose exec db psql -U $POSTGRES_USER -d ${TEST_DB} \
  -c "SELECT 'organisations' as table_name, COUNT(*) FROM organisations
      UNION ALL SELECT 'users', COUNT(*) FROM users
      UNION ALL SELECT 'memberships', COUNT(*) FROM memberships
      UNION ALL SELECT 'staff_profiles', COUNT(*) FROM staff_profiles
      UNION ALL SELECT 'clients', COUNT(*) FROM clients;"

# Cleanup
docker compose exec db psql -U $POSTGRES_USER \
  -c "DROP DATABASE ${TEST_DB};"

echo "Monthly restore test: PASSED"
```

---

## Emergency Recovery

### Scenario 1: Database Corruption

1. **Stop application immediately**
2. **Assess damage**: Check PostgreSQL logs
3. **Identify last known good backup**
4. **Perform full restore** (see Method 1 above)
5. **Re-apply any migrations** if needed:
   ```bash
   CONFIRM_DB_BACKUP=yes npm run db:migrate
   ```
6. **Verify application health**
7. **Document incident**

### Scenario 2: Accidental Data Deletion

1. **Stop application** to prevent further changes
2. **Identify affected data** from audit logs
3. **Option A**: Full restore if extensive
4. **Option B**: Selective table restore if limited
5. **Notify affected users**

### Scenario 3: Server Failure

1. **Provision new server** via Coolify
2. **Deploy application** (code from Git)
3. **Restore database** from offsite backup
4. **Update DNS** if needed
5. **Verify all services**

### Emergency Contacts

| Role | Contact |
|------|---------|
| Platform Admin | (Configure) |
| Database Admin | (Configure) |
| Infrastructure | (Configure) |

---

## Test Restore Procedure

**Purpose:** Verify backup restorability without affecting production.

### Prerequisites

- Isolated test environment (separate server or Docker network)
- Copy of latest production backup
- Test DATABASE_URL pointing to test instance

### Step-by-Step Test Restore

```bash
# 1. Create isolated test environment
docker network create encare-test-net

# 2. Start test PostgreSQL
docker run -d \
  --name encare-test-db \
  --network encare-test-net \
  -e POSTGRES_USER=test_user \
  -e POSTGRES_PASSWORD=test_password \
  -e POSTGRES_DB=encare_test \
  postgres:17-alpine

# 3. Wait for database ready
sleep 10

# 4. Restore backup
docker exec -i encare-test-db pg_restore \
  -U test_user \
  -d encare_test \
  < ./backups/latest_backup.dump

# 5. Verify record counts
docker exec encare-test-db psql -U test_user -d encare_test \
  -c "SELECT COUNT(*) as org_count FROM organisations;"

docker exec encare-test-db psql -U test_user -d encare_test \
  -c "SELECT COUNT(*) as user_count FROM users;"

# 6. Test application connectivity (optional)
docker run -d \
  --name encare-test-app \
  --network encare-test-net \
  -e DATABASE_URL=postgresql://test_user:test_password@encare-test-db:5432/encare_test \
  -e AUTH_SECRET=test-secret-minimum-32-characters \
  -e APP_URL=http://localhost:3000 \
  -p 3001:3000 \
  encare-app:latest

# 7. Test health endpoint
curl http://localhost:3001/api/health

# 8. Cleanup
docker stop encare-test-app encare-test-db
docker rm encare-test-app encare-test-db
docker network rm encare-test-net

echo "Test restore completed successfully"
```

### Documentation After Test

Record the following after each test restore:

| Field | Value |
|-------|-------|
| Date | |
| Backup File | |
| Backup Date | |
| Restore Duration | |
| Records Verified | |
| Issues Found | |
| Tested By | |

---

## Appendix: Common Issues

### Issue: pg_restore fails with "role does not exist"

**Cause:** Backup contains role references that don't exist in target.

**Solution:**
```bash
pg_restore --no-owner --no-privileges -U $POSTGRES_USER -d $POSTGRES_DB backup.dump
```

### Issue: Backup file too large

**Solution:** Use compression:
```bash
pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -F c -Z 9 -f backup_compressed.dump
```

### Issue: Restore takes too long

**Solution:** Disable indexes during restore:
```bash
pg_restore --disable-triggers --no-indexes -U $POSTGRES_USER -d $POSTGRES_DB backup.dump
# Then rebuild indexes
psql -U $POSTGRES_USER -d $POSTGRES_DB -c "REINDEX DATABASE ${POSTGRES_DB};"
```

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-10-22 | Initial documentation |
