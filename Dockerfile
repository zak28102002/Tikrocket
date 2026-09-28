# Pulse — one image for both processes:
#   web:    pnpm start      (Next.js)
#   worker: pnpm worker     (background collection)
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# Bake pnpm into the image so containers never download it at startup.
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Prisma's config reads DATABASE_URL; generation/build never connect, so a placeholder is fine.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$DATABASE_URL
RUN pnpm exec prisma generate && pnpm exec next build

FROM base AS runner
ENV NODE_ENV=production PORT=3000
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "start"]
