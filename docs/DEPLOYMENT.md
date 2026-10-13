# Deployment Guide

This guide covers the supported deployment shapes for Connect Me. The Express API and Next.js web application remain separate deployable processes in all modes; “combined” means one public web origin, not merging the API into Next.js.

## 1. Required configuration

Create a deployment-specific `.env` from the safe template:

```bash
cp .env.example .env
```

Populate every required value. Generate independent signing keys, never reuse them between environments:

```bash
openssl rand -hex 24  # use the output for POSTGRES_PASSWORD
openssl rand -hex 32  # use the output for SESSION_SECRET
openssl rand -hex 32  # run again for JWT_SECRET
```

Use a URL-safe password such as random hex for PostgreSQL. `DATABASE_URL` must be a literal PostgreSQL connection string for processes running on the host. Docker Compose constructs a separate container-to-database URL using the configured role/password and the internal `postgres` hostname.

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Yes for Compose | PostgreSQL/Compose | Database role, secret and database name. No default role or password is supplied. |
| `DATABASE_URL` | Yes for host processes | API, Prisma CLI | Database connection reachable from the host process. |
| `TEST_DATABASE_URL` | Yes for integration tests | Vitest | Isolated test database; its database name must end in `_test` or `_testing`. |
| `SESSION_SECRET`, `JWT_SECRET` | Yes | API | Separate keys for browser session and mobile bearer-token signing. At least 32 characters each. |
| `CORS_ORIGIN` | Required in production | API | Comma-separated, exact browser origins, without trailing slashes. Never use `*` with credentialed requests. |
| `QR_CANONICAL_ORIGIN` | Required in production | API | Public origin used to construct QR URLs. |
| `NEXT_PUBLIC_APP_URL` | Yes for bootstrap | Bootstrap CLI | Public web origin; setup links end in `/setup` and do not include the setup token. |
| `API_INTERNAL_URL` | Yes when web is separate from API | Next.js server | Server-only URL of Express. It is never placed in browser code. |
| `NEXT_PUBLIC_API_BASE_URL` | Optional | Web browser bundle | Public API origin for direct cross-origin browser requests. Leave blank for the recommended same-origin web proxy. This is a build-time public value, not a secret. |
| `EXPO_PUBLIC_API_URL` | For device/mobile release | Expo app | Public API origin reachable from the mobile device. |

Do not copy the blank values unchanged into a running environment. Never commit `.env`, database dumps, signing secrets, or a generated bootstrap token.

## 2. Combined public origin with Docker Compose

This mode places Next.js and Express in separate containers while exposing the website as the normal public entry point. The web process proxies API paths to Express with the runtime `API_INTERNAL_URL`; browser JavaScript normally uses same-origin relative paths.

1. Set `NEXT_PUBLIC_APP_URL` and `QR_CANONICAL_ORIGIN` to the public web origin, such as `https://connectme.example.com`.
2. Set `CORS_ORIGIN` to that exact origin. For local testing use `http://localhost:3000`.
3. Generate separate `SESSION_SECRET` and `JWT_SECRET` values.
4. Confirm `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and the local `DATABASE_URL` are populated.

Run the managed Prisma migration and bootstrap before starting the app:

```bash
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm bootstrap
```

The bootstrap command prints a 256-bit one-time token to its terminal output. Open the printed `/setup` URL, paste the token manually, and choose the admin username and password. Do not post the token in an issue, URL, or shared log.

Then launch the API and web services together:

```bash
docker compose --profile combined up --build -d
docker compose --profile combined ps
docker compose logs --tail=100 api web
```

The legacy `app` profile remains an alias for the combined API + web deployment.

By default, Compose binds API and web ports to loopback. Put a TLS-terminating reverse proxy (for example, Nginx or Caddy) in front of port 3000 for the public website. If a separately addressed API is needed for the mobile client, expose Express behind an API hostname, such as `https://api.example.com`, and set `EXPO_PUBLIC_API_URL` in the mobile build to that origin.

Migrations are deliberately not run on API startup. Apply migrations as a deployment step before rolling out application instances.

### Run only one application tier with Compose

The Compose profiles are designed to avoid starting unrelated services:

```bash
# API + PostgreSQL only; no Next.js process.
docker compose --profile api up --build -d api

# Next.js only; API and PostgreSQL must already be hosted elsewhere.
docker compose --profile web up --build -d web
```

For the web-only command, set `COMPOSE_API_INTERNAL_URL` in the deployment environment or `.env` to an HTTP(S) URL that the web container can reach. For example, use the private service URL of an API hosted in the same network or the API's public HTTPS origin. Leave it blank for the combined profile, where Compose uses `http://api:4000` on its internal network. Do not set it to `localhost:4000` for a web container unless the API actually runs inside that same container.

These profiles let you run API, web, or both from the same repository and Dockerfile while keeping Express as the authoritative API. A combined public origin is still achieved by placing the public reverse proxy in front of Next.js; the API and web are not merged into one process.

## 3. Independently deployed API and web services

Build the targets independently from the same workspace source:

```bash
docker build --target api -t connectme-api .
docker build --target web -t connectme-web .
```

The images carry the built monorepo and workspace dependencies. The Docker build uses random temporary database URL components only for Prisma client generation; runtime credentials are supplied separately and are not baked into the image.

### API service

Supply the API container with production values for `NODE_ENV`, `PORT`, `DATABASE_URL`, `SESSION_SECRET`, `JWT_SECRET`, `CORS_ORIGIN`, and `QR_CANONICAL_ORIGIN`. Its database URL must reference the database host/service accessible from the API container, not `localhost` unless PostgreSQL is in that same container (not recommended). Keep the database network private.

### Web service

Supply the web container with `API_INTERNAL_URL` pointing to the deployed API origin or private service address and `NEXT_PUBLIC_APP_URL` pointing to the public website origin. When the browser should use the same-origin proxy, leave `NEXT_PUBLIC_API_BASE_URL` empty. In this arrangement API and web are separately deployed but the browser still talks only to the web origin.

To have browser JavaScript call the API's public origin directly, set `NEXT_PUBLIC_API_BASE_URL=https://api.example.com` as a **web build argument** and rebuild the web target. Configure `CORS_ORIGIN` on the API to include the exact web origin. Production session cookies use `Secure` and `SameSite=None` to allow credentialed cross-origin use; browser third-party-cookie restrictions can still apply, so same-origin proxying is preferred.

Mobile clients call the API directly and should receive `EXPO_PUBLIC_API_URL` at Expo build time. Never put database URLs, signing keys, or other secrets in `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` values.

## 4. Local host process deployment

Start PostgreSQL with Compose and run the API/web in development mode on the host:

```bash
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:bootstrap
pnpm dev:api:web
```

The web default is port 3000 and API default is port 4000. `API_INTERNAL_URL=http://localhost:4000` lets Next.js proxy requests at runtime. The root environment loader is used by the API and Prisma commands; the connection values in `.env` must still be literal values, not shell-style `${VARIABLE}` references.

## 5. Managed schema changes

- Modify `packages/database/prisma/schema.prisma`.
- Create a reviewed local migration with `pnpm db:migrate:dev` against a development database.
- Commit both schema and new SQL under `packages/database/prisma/migrations`.
- In production, apply committed migrations using `pnpm db:migrate` or the Compose `migrate` one-off service.
- Do not use `prisma db push` or automatically mutate schema during API startup.

## 6. Initial administrator lifecycle

`pnpm db:bootstrap` generates an unguessable one-time setup token and creates a pending placeholder row with a random, non-meaningful identifier. It does not set a username, password, email address, or default login. The owner enters the token manually on `/setup` and selects the identity/password on that page.

The token is hashed in PostgreSQL, expires, is atomically consumed at setup, and is removed after activation. The `is_initial_admin` unique constraint is an additional database-level guarantee that only one initial admin can be activated. Setup status does not disclose the placeholder username. URLs do not carry tokens.

If a pending token is lost or expired, deliberately rotate it with `pnpm db:bootstrap:rotate` or run `pnpm db:bootstrap:rotate` in the bootstrap container. This is only allowed while no admin is active. Once initialization completes, re-running bootstrap or rotation refuses; it does not automatically reopen setup. Any emergency recovery should be an explicit operator-led database procedure with a backup.

## 7. Integration tests

The API integration tests delete and recreate rows. Set `TEST_DATABASE_URL` to an isolated PostgreSQL database ending in `_test` or `_testing`, apply the Prisma migrations to it, then run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Vitest refuses to run the destructive suite against an ordinary database. It uses ephemeral signing secrets when test-only values are not supplied.

## 8. Health and API docs

- API liveness: `/health/live`
- API readiness: `/health/ready`
- OpenAPI / Swagger UI: `/api/docs`
- Versioned endpoints: `/api/v1/*`

In combined-origin mode, the Next runtime proxy exposes the health and Swagger paths as well. Configure platform health probes directly against the API liveness/readiness endpoints where practical.
