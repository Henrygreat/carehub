# FalconCare Hub - Single Production Dockerfile
# Includes Next.js app AND database migration tools (tsx, Prisma CLI 6.19.3)
#
# COOLIFY CONFIGURATION:
#   Build Pack:        Dockerfile
#   Dockerfile Path:   Dockerfile
#   Docker Context:    . (repository root)
#
# REQUIRED ENVIRONMENT VARIABLES:
#   DATABASE_URL       PostgreSQL connection string
#   AUTH_SECRET        NextAuth secret (min 32 chars)
#   APP_URL            Application URL (https://...)
#
# MIGRATION COMMANDS (run in Coolify terminal):
#   npm run db:status                              # Check migration status
#   CONFIRM_DB_BACKUP=yes npm run db:migrate       # Apply migrations
#   npm run db:bootstrap-admin                     # Create first admin user

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# -----------------------------------------------------------------------------
# Stage: deps - Install ALL dependencies (including devDependencies)
# -----------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
# NODE_ENV must not be production here, or devDependencies are skipped
ENV NODE_ENV=development
RUN npm ci

# -----------------------------------------------------------------------------
# Stage: builder - Build Next.js application
# -----------------------------------------------------------------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Stage: migration-tools - Extract only migration dependencies
# This creates a minimal node_modules with tsx, prisma, and dotenv
# -----------------------------------------------------------------------------
FROM base AS migration-tools
COPY package.json package-lock.json ./
ENV NODE_ENV=development
# Install only the packages needed for migrations (tsx, prisma CLI, dotenv)
# Using npm install instead of npm ci to get a smaller subset
RUN npm install --ignore-scripts \
    tsx@4.23.15 \
    prisma@6.19.3 \
    dotenv@18.0.7 \
    && npm cache clean --force

# Verify the tools are installed correctly
RUN echo "=== Migration tools verification ===" \
    && ./node_modules/.bin/tsx --version \
    && ./node_modules/.bin/prisma --version \
    && ./node_modules/.bin/prisma --version | grep -q "6.19.3" \
    && echo "=== Verification passed ==="

# -----------------------------------------------------------------------------
# Stage: runner - Final production image
# -----------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Copy Next.js standalone build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy migration tools (tsx, prisma CLI, dotenv) from migration-tools stage
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/tsx ./node_modules/tsx
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/dotenv ./node_modules/dotenv
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/get-tsconfig ./node_modules/get-tsconfig
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/resolve-pkg-maps ./node_modules/resolve-pkg-maps
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

# Copy bcryptjs for bootstrap-admin script
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy package.json for npm scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy Prisma schema, migrations, and config
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Copy database operation scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/database-operation.ts ./scripts/database-operation.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/bootstrap-admin.mjs ./scripts/bootstrap-admin.mjs
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/environment.ts ./src/lib/environment.ts

# Generate Prisma client for Alpine Linux
# CRITICAL: Use local prisma, NOT npx (which downloads latest version)
RUN ./node_modules/.bin/prisma generate

# Verify migration tools work
RUN echo "=== Final image verification ===" \
    && echo "tsx:" && ./node_modules/.bin/tsx --version \
    && echo "prisma:" && ./node_modules/.bin/prisma --version \
    && echo "Migrations:" && ls -la prisma/migrations/ \
    && echo "=== Verification complete ==="

# Fix ownership after prisma generate
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start Next.js server
CMD ["node", "server.js"]
