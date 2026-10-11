FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
RUN npm install --global npm@10.9.4
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Release-only image: pinned Prisma CLI 6.19.3 (from package-lock.json), the
# migration history and the guarded wrapper. Nothing runs at build time; it is
# started explicitly with the commands in the README. Never used to serve the app.
FROM base AS migrator
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
COPY scripts/database-operation.ts ./scripts/database-operation.ts
COPY src/lib/environment.ts ./src/lib/environment.ts
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 migrator \
  && chown -R migrator:nodejs /app
USER migrator
CMD ["sleep", "infinity"]

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# One-time administrator bootstrap (plain Node script; bcryptjs is bundled into
# the Next.js output, so it is copied explicitly for the script).
COPY --from=builder --chown=nextjs:nodejs /app/scripts/bootstrap-admin.mjs ./scripts/bootstrap-admin.mjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
