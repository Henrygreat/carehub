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
# Stage: migration-tools - Create minimal node_modules for migrations
# Installs tsx, prisma CLI, dotenv with complete dependency trees
# -----------------------------------------------------------------------------
FROM base AS migration-tools
WORKDIR /app
COPY package.json package-lock.json ./
ENV NODE_ENV=development
# Install migration tools with their complete dependency trees
RUN npm install --ignore-scripts \
    tsx@4.23.15 \
    prisma@6.19.3 \
    dotenv@18.0.7 \
    && npm cache clean --force

# Verify installation
RUN ./node_modules/.bin/tsx --version \
    && ./node_modules/.bin/prisma --version | grep -q "6.19.3"

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

# Copy Next.js standalone build (includes bundled production dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy ENTIRE node_modules from migration-tools (includes complete dependency trees)
# This overwrites the minimal node_modules from standalone with migration tools
COPY --from=migration-tools --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy bcryptjs from builder (needed for bootstrap-admin.mjs)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy @prisma/client from builder (generated for this platform during build)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy package.json for npm scripts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Copy Prisma schema, migrations, and config
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Copy database operation scripts
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/environment.ts ./src/lib/environment.ts

# Generate Prisma client for Alpine Linux runtime
# Use local prisma from node_modules, NOT npx (which downloads latest version)
RUN ./node_modules/.bin/prisma generate

# Verify the final image has all required tools
RUN echo "=== Final Image Verification ===" \
    && echo "Node: $(node --version)" \
    && echo "tsx: $(./node_modules/.bin/tsx --version)" \
    && echo "prisma CLI: $(./node_modules/.bin/prisma --version)" \
    && echo "Checking npm ls:" \
    && npm ls tsx prisma @prisma/client --depth=0 2>/dev/null || true \
    && echo "Migrations directory:" \
    && ls -la prisma/migrations/ \
    && echo "=== Verification Complete ==="

# Ensure correct ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start Next.js server
CMD ["node", "server.js"]
