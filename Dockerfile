# =============================================================================
# Red Carpet Chemical Inventory — Production Dockerfile (API Server)
# Builds and runs the Express API server.
# =============================================================================

# ---- Build stage ----
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json tsconfig.base.json ./

COPY lib/db/package.json             lib/db/
COPY lib/api-zod/package.json        lib/api-zod/
COPY lib/api-spec/package.json       lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/
COPY lib/integrations-openai-ai-react/package.json  lib/integrations-openai-ai-react/
COPY artifacts/api-server/package.json artifacts/api-server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy all source
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/

# Build shared libs then the API server
RUN pnpm run typecheck:libs
RUN pnpm --filter @workspace/api-server run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests (needed for pnpm to resolve workspace packages)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.json tsconfig.base.json ./

COPY lib/db/package.json             lib/db/
COPY lib/api-zod/package.json        lib/api-zod/
COPY lib/api-spec/package.json       lib/api-spec/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY lib/integrations-openai-ai-server/package.json lib/integrations-openai-ai-server/
COPY lib/integrations-openai-ai-react/package.json  lib/integrations-openai-ai-react/
COPY artifacts/api-server/package.json artifacts/api-server/

# Production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/artifacts/api-server/dist/ artifacts/api-server/dist/

# Run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

ENV PORT=8080
ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/api/healthz || exit 1

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
