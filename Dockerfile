# syntax=docker/dockerfile:1.7
# Life Energy Centre CRM — production Docker image.
#
# Strategy: multi-stage build off node:20-bookworm-slim (Debian, glibc — needed
# for Prisma's binary engines). Next.js standalone output keeps the final image
# around ~250 MB. Migrations run at container start (not build), because the DB
# may not be reachable from the build stage.

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: install deps
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Prisma's engine binaries need OpenSSL at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy lockfile first for cache.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `npm ci` runs `postinstall` → `prisma generate`. That's fine because the
# generated client is platform-agnostic JS + native engine binary which we want
# baked into the image.
RUN npm ci --include=dev

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: build the Next.js app
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Dummy env values at build time — Next.js statically analyses imports and
# evaluates `env.ts` while collecting page data, so the Zod schema must pass.
# Real values are injected at runtime via env_file.
ENV DATABASE_URL="postgresql://stub:stub@stub:5432/stub?schema=public"
ENV AUTH_SECRET="build_time_stub_secret_replaced_at_runtime"
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_SEED=true
# We override the package.json `build` script — that one tries to migrate and
# seed, which needs a real DB. The Dockerfile build only does generate + build.
RUN npx prisma generate && npx next build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: minimal runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

# Install Prisma CLI + tsx globally with their own complete dependency trees.
# Avoids the "Cannot find module 'effect'" error caused by Next.js standalone
# bundle pruning prisma's transitive deps from the app's node_modules.
RUN npm install -g prisma@6.19.3 tsx@4.21.0 && npm cache clean --force

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Kolkata

# Non-root user
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# Copy build output. Next.js standalone bundle includes a minimal node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma needs the schema + migrations at runtime to apply migrations on boot.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Generated Prisma client (the runtime client, not the CLI) needs to live in
# the app's node_modules so the app can `import { PrismaClient } from "@prisma/client"`.
# The CLI is installed globally above, separate from this.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Packages used by prisma/seed.ts (run on first boot if SKIP_SEED != true).
# Next's standalone bundle prunes anything not imported by the app's entry
# chain — seed.ts has its own imports, so we restore them explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Entry script: apply migrations, optionally seed, then start the server.
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--", "./entrypoint.sh"]
