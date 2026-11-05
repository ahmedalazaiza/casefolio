# syntax=docker/dockerfile:1
# Casefolio Playwright Export Worker (Fly.io / Railway)
FROM mcr.microsoft.com/playwright:v1.58.2-noble

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/db/package.json packages/db/tsconfig.json ./packages/db/
COPY packages/template-schema/package.json packages/template-schema/tsconfig.json ./packages/template-schema/
COPY apps/worker/package.json apps/worker/tsconfig.json apps/worker/tsconfig.build.json ./apps/worker/

RUN pnpm install --frozen-lockfile --filter @casefolio/worker...

COPY packages/db/src ./packages/db/src
COPY packages/template-schema/src ./packages/template-schema/src
COPY apps/worker/src ./apps/worker/src

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1

CMD ["node", "--experimental-strip-types", "apps/worker/src/index.ts"]

