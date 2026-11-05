# syntax=docker/dockerfile:1
# Casefolio Headless Chromium Export Worker (@casefolio/worker)
# Build from monorepo root:
#   docker build -f apps/worker/Dockerfile -t casefolio-export-worker:latest .

FROM mcr.microsoft.com/playwright:v1.52.0-noble

ENV NODE_ENV=production \
    PORT=4000 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/template-schema/package.json packages/template-schema/package.json
COPY apps/worker/package.json apps/worker/package.json

RUN pnpm install --frozen-lockfile --filter @casefolio/worker...

COPY packages/db packages/db
COPY packages/template-schema packages/template-schema
COPY apps/worker apps/worker

RUN pnpm exec playwright install chromium

USER pwuser
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--experimental-strip-types", "apps/worker/src/index.ts"]
