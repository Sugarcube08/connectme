# Deploy the Connect Me API to Vercel

This guide covers deploying `apps/api` as the first Vercel project. The Next.js web app can remain a separate project. The Express API stays authoritative for business logic and database access.

## 1. Configure a managed MySQL database

Provision a managed MySQL database through your chosen provider. Use a **new, empty database** for the MySQL migration baseline in this repository. Do not point this migration history at an old PostgreSQL database.

The checked-in `apps/api/.env.example` documents local API settings. Vercel does not load this file automatically; set the variables in the API project's Environment Variables settings.

Set the API project's production environment variables in Vercel:

| Variable | Required | Value |
|---|---:|---|
| `DATABASE_URL` | Yes | Provider-issued MySQL URL, `mysql://user:password@host:3306/database`; use the provider's recommended pooled URL for serverless runtime when available. |
| `SESSION_SECRET` | Yes | Unique random secret, at least 32 characters. |
| `JWT_SECRET` | Yes | A different unique secret, at least 32 characters. |
| `NODE_ENV` | Recommended | `production`. |
| `MAX_IMAGE_SIZE_BYTES` | Optional | Defaults to `2097152` (2 MiB). |
| `MAX_BATCH_CODE_COUNT` | Optional | Defaults to `100`. |

Generate independent signing keys locally:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Paste the outputs into Vercel's Environment Variables settings. Never add real values to `.env.example`, commit them, or expose them as `NEXT_PUBLIC_*` variables. Prisma requires special characters in URL components—including usernames and passwords—to be percent-encoded. Example: `p@ss:word%` becomes `p%40ss%3Aword%25`. Keep the provider-issued connection URL encoded as supplied; do not manually decode it.

### Removed origin variables

Do **not** configure `CORS_ORIGIN` or `QR_CANONICAL_ORIGIN`. The API no longer reads either variable. Remove existing copies from the Vercel project's Production, Preview, and Development environment variable sets as appropriate.

- **CORS:** Same-origin browser requests are permitted when the origin matches the request host; Vercel deployment domains are derived from Vercel's system environment variables. Unknown third-party browser origins are rejected rather than reflected. Native and server-to-server requests with no `Origin` header do not need a browser CORS grant.
- **QR URLs:** The Next.js proxy sends the public web origin in a server-generated `X-ConnectMe-Public-Origin` header. The API falls back to Vercel deployment metadata or the request host when there is no proxy-provided origin.

For the web dashboard, keep the browser API base URL empty so browser requests go through the same-origin Next.js proxy. This avoids needing a configured cross-origin allow-list.

## 2. Build and deploy the API project

Connect `Sugarcube08/connectme` to Vercel and configure a dedicated API project with **Root Directory = `apps/api`**. Keep the monorepo's files outside the app directory available to the build (the workspace lockfile and `packages/*` are required). The Vercel entry point is `apps/api/src/index.ts`, which default-exports the Express app; `src/server.ts` remains the normal Node/Docker listener.

Use this build command in the API project's Build & Development Settings so Prisma Client and workspace dependencies are built before the API:

```bash
cd ../.. && pnpm exec turbo run build --filter=@connectme/api...
```

Use the repository-root pnpm lockfile for dependency installation. Leave the output directory unset; Vercel should package the Express function rather than serve a static build. Confirm the build log shows `@connectme/database` generated/built before `@connectme/api`. Do not deploy until the build includes `packages/database` and its generated Prisma client.

After adding or changing Vercel environment variables, create a new deployment. Existing deployments do not inherit environment-variable changes retroactively.

## 3. Apply the MySQL schema

Run the reviewed Prisma migration against the selected MySQL database from an operator-controlled environment with the repository dependencies installed and `DATABASE_URL` set to that database:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
```

Migrations are not run automatically when an API request starts. Apply the baseline to a fresh MySQL database before using the application. The prior PostgreSQL migration SQL was removed because migrations are database-provider-specific. Any data already stored in PostgreSQL needs a separately planned export/import; changing the connection string is not a data migration.

## 4. Create the first administrator

After the Next.js web project is available, run the bootstrap CLI against the **same production MySQL database**. Set `NEXT_PUBLIC_APP_URL` for the CLI to your public web origin if it does not already match the environment where the command is being run:

```bash
NEXT_PUBLIC_APP_URL=https://<your-web-domain> pnpm db:bootstrap
```

Copy the one-time token from the terminal into the web app's `/setup` form. The CLI does not create an administrator password or username. Never place the token in an issue, URL, source control, or shared logs.

If the API is being deployed before the web project exists, keep the database initialized but defer bootstrap until you can access the setup form on the web app.

## 5. Smoke tests

After deployment, replace the hostname below with the API's actual Vercel domain:

- `/health/live` — confirms the function responds.
- `/health/ready` — confirms the API can connect to MySQL.
- `/api/docs` — Swagger UI, if the OpenAPI definition is included in the deployed bundle.

If liveness succeeds but readiness returns `503`, verify the MySQL URL, provider network/access settings, and applied migration status.

### Troubleshooting: runtime still requires legacy origin variables

If a Vercel runtime log says `Missing required production environment values: CORS_ORIGIN, QR_CANONICAL_ORIGIN`, that function is running an older API bundle. The current `apps/api/src/config/env.ts` does not declare or require either variable. **Do not restore the obsolete variables to mask the error.**

1. Open the failing deployment in Vercel and check its source commit. It must include the current `main` code where those variables were removed.
2. Verify the API project's Git repository is `Sugarcube08/connectme`, its production branch is `main`, and its Root Directory/build configuration follows this guide.
3. Redeploy the latest `main` commit with **Use existing Build Cache** disabled if the source commit is correct but the runtime still contains the old validation code.
4. Recheck `/health/live` and `/health/ready` on the new deployment.

## 6. Connect the web project later

In the separate Next.js Vercel project, set this **server-only** variable:

```dotenv
API_INTERNAL_URL=https://<your-api-vercel-domain>
```

Keep the browser client on the same-origin proxy and do not set a direct public API URL. The web proxy removes browser CORS metadata and sends its own public origin so generated QR codes point to the web app, not to the API project's domain.

Native mobile can call the API's public Vercel domain through `EXPO_PUBLIC_API_URL`. Because successful first-admin setup persists the web origin in MySQL, mobile code-generation requests without browser-origin headers use the same website origin. Vercel deployment metadata is only the fallback if the initial setup did not pass through the web proxy.
