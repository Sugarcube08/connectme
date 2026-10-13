# Connect Me — Development Guide

## Current architecture

Connect Me is a pnpm/Turborepo TypeScript monorepo. Express is the authoritative REST API, Next.js is the web client and same-origin runtime proxy, React Native/Expo is the mobile admin client, and Prisma manages MySQL schema migrations.

- `apps/api`: Express MVC, auth, QR codes, contact collection/CRM, image retrieval, health endpoints, Swagger UI.
- `apps/web`: Next.js public contact form, setup flow, dashboard and runtime API proxy.
- `apps/mobile`: Expo native admin client with secure token storage.
- `packages/database`: Prisma schema, migrations and bootstrap CLI.
- `packages/api-client`, `packages/contracts`, `packages/validation`, `packages/design-tokens`: shared client types, schemas and design system.

## Deployment modes

**Local development:** API `localhost:4000`; web `localhost:3000`; MySQL `localhost:3306`.

**One public origin:** Keep API and web as separate processes. Next.js proxies `/api/v1/*`, `/health/*`, and `/api/docs/*` to the Express API using runtime, server-only `API_INTERNAL_URL`. This is the default combined public deployment mode.

**Docker Compose profiles:** Use `docker compose --profile api up --build -d api` for API + MySQL only, `docker compose --profile web up --build -d web` for a web container whose API is hosted elsewhere, or `docker compose --profile combined up --build -d` for both app services together. In web-only mode, set `COMPOSE_API_INTERNAL_URL` to an API URL reachable from inside the web container. The legacy `app` profile still launches both app services.

**Independently hosted services:** Build/deploy `apps/api` and `apps/web` independently. Configure `API_INTERNAL_URL` on the web service to the API origin/private service address. Leave `NEXT_PUBLIC_API_BASE_URL` empty and use the Next.js same-origin proxy. The API derives same-origin CORS from the request host and Vercel system domains; it does not reflect arbitrary browser origins. Native mobile uses `EXPO_PUBLIC_API_URL` and normally sends no browser Origin header.

## Environment configuration

1. Copy `.env.example` to `.env`.
2. Choose `MYSQL_ROOT_PASSWORD`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`.
3. Set `DATABASE_URL` to a literal URL usable from the host process (usually hostname `localhost`).
4. Set `TEST_DATABASE_URL` to a separate database ending in `_test`.
5. Generate distinct secrets using `openssl rand -hex 32` and set `SESSION_SECRET` and `JWT_SECRET`.
6. Set `NEXT_PUBLIC_APP_URL` for the bootstrap CLI's setup link. `CORS_ORIGIN` and `QR_CANONICAL_ORIGIN` are no longer required or read. Browser traffic should use the same-origin web proxy; `NEXT_PUBLIC_API_BASE_URL` is not used.

There are no configured administrator credentials and no production fallback signing keys. The API fails fast if its database URL or signing secrets are missing/too short. CORS derives same-origin/Vercel hosts automatically. QR generation uses the public origin from the Next.js proxy, then Vercel deployment metadata/request host as a fallback.

Do not commit `.env`. Environment examples must contain no real credentials. Database passwords should use URL-safe characters, such as random hex, when embedded in `DATABASE_URL`.

## Local setup

```bash
docker compose up -d mysql
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:bootstrap
pnpm dev:api:web
```

Use `pnpm db:migrate:dev` only for local schema development. Use `pnpm db:migrate`/`pnpm db:migrate:deploy` to apply checked-in Prisma migrations. Migrations are not run automatically during API startup.

The bootstrap command prints a single-use setup token in the terminal. Enter it manually on `/setup`; it is not appended to the URL, and the owner chooses the account username/password on the site. A pending provision is not silently replaced. Use `pnpm db:bootstrap:rotate` only to intentionally rotate a lost/expired token before an administrator exists.

## Tests

Integration tests are destructive to the selected database. Set `TEST_DATABASE_URL` to an isolated MySQL database whose name ends in `_test` or `_testing`, and apply migrations to that database before running `pnpm test`. The Vitest setup refuses to run against an ordinary database and generates ephemeral signing secrets when needed.

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Docker deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for combined and independent deployments, environment maps, bootstrap/migration procedures, and reverse-proxy guidance.

## Operational invariants

- Express is the single authority for business rules and database access. Web and mobile never connect directly to MySQL.
- Every public QR token is one-use; concurrent submissions may create only one contact record.
- Initial administrator bootstrap is tokenized, has no configured identity, is atomic, and is permanently locked after completion.
- Profile-image binary data lives in `submission_images`, separate from the listable contact rows.
- Prisma schema changes are recorded as reviewed migrations in `packages/database/prisma/migrations`.
- Use Conventional Commits and keep generated output, local secrets, test reports and database dumps out of Git.
