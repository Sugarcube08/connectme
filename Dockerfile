FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.11.2 --activate

# Keep the whole workspace in the build context because shared packages are linked
# with workspace:* and both server applications import generated Prisma/client code.
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm install --frozen-lockfile

# Prisma generation validates the datasource URL but does not connect to a database.
# Use throwaway random build-only values; runtime credentials are injected by the platform.
RUN BUILD_DB_USER="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(12).toString("hex"))')" \
 && BUILD_DB_PASS="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')" \
 && export DATABASE_URL="postgresql://${BUILD_DB_USER}:${BUILD_DB_PASS}@127.0.0.1:5432/build_only" \
 && pnpm db:generate \
 && pnpm build

FROM base AS api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["pnpm", "--filter", "@connectme/api", "start"]

FROM base AS web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@connectme/web", "start"]
