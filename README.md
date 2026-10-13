# Connect Me

> **You share. We connect.**

Connect Me is a lightweight, single-use QR contact-capture system for in-person networking at technical conferences. Each printed card contains an unpredictable, one-time URL. A visitor submits their contact details; the owner reviews the contact privately in the web dashboard or mobile app.

## Privacy and product rules

- Public pages never disclose the owner's phone, email, vCard, social links, or personal identity.
- No reciprocal contact exchange, public attendee directory, attendee login, OTP, SMS, or AI service is required.
- Each access token can be redeemed once. Redemption is atomic in MySQL, including under concurrent requests.
- Optional profile images are normalized and stored in a separate MySQL `LONGBLOB` table.
- The owner chooses their own administrator username and password during first-time setup. There are no preset admin credentials.

## Architecture

```text
apps/
  api/       Express MVC API — authoritative business logic and data access
  web/       Next.js — mobile-first public form and administrator dashboard
  mobile/    React Native + Expo — mobile administrator client
packages/
  database/  MySQL + Prisma schema and managed migrations
  api-client/ Shared typed API client
  contracts/ Shared DTOs and API response types
  validation/Shared Zod validation schemas
  design-tokens/ Obsidian, royal violet, ivory and restrained gold palette
docs/
  openapi.yaml
  decisions/ Architecture Decision Records
```

The API remains a separate process even when web and API are presented under one public origin. This allows either service to be built and deployed independently.

## Deployment modes

| Mode | How it works |
|---|---|
| Local development | Express on `localhost:4000`, Next.js on `localhost:3000`, MySQL on `localhost:3306`. |
| Combined public origin | Express and Next.js remain separate processes; Next.js proxies `/api/v1/*`, `/health/*`, and `/api/docs/*` using server-only `API_INTERNAL_URL`. |
| API-only Compose profile | `--profile api` starts MySQL and Express without starting Next.js. |
| Web-only Compose profile | `--profile web` starts Next.js without a local API or database; configure `COMPOSE_API_INTERNAL_URL` to an API reachable from the web container. |
| Combined Compose profile | `--profile combined` starts MySQL, API, and web together. The legacy `app` profile remains available. |
| Independently hosted services | API and web can be built/deployed as separate targets. Configure the web server's `API_INTERNAL_URL` to the API. Browser requests always use the same-origin Next.js proxy; `API_INTERNAL_URL` is server-only and does not need CORS configuration. |

The runtime proxy preserves request bodies, cookies and binary responses. It supports CSV exports and contact images without loading image bytes into the web app.

## Quick start

### 1. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`. Choose a MySQL application user/password and a distinct root password; use URL-safe random hex for the passwords. Generate **different** signing secrets for sessions and mobile JWTs:

```bash
openssl rand -hex 24  # paste output into MYSQL_ROOT_PASSWORD
openssl rand -hex 32  # paste output into SESSION_SECRET
openssl rand -hex 32  # run again; paste output into JWT_SECRET
openssl rand -hex 24  # paste output into MYSQL_PASSWORD
```

Set `DATABASE_URL` to a literal local MySQL URL using your chosen application user/password, such as `mysql://<user>:<password>@localhost:3306/connectme`. Set `TEST_DATABASE_URL` to a separate MySQL database whose name ends in `_test` (for example, `mysql://<user>:<password>@localhost:3306/connectme_test`). Do not leave required values blank. Never commit `.env`.

### 2. Start MySQL and install dependencies

```bash
docker compose up -d mysql
pnpm install
pnpm db:generate
pnpm db:migrate
```

Create the separate test database once (replace the role name with the one you configured):

```bash
docker compose exec mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS connectme_test;"'
docker compose exec mysql sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "GRANT ALL PRIVILEGES ON connectme_test.* TO '\''${MYSQL_USER}'\''@'\''%'\'';"'
DATABASE_URL='mysql://<user>:<password>@localhost:3306/connectme_test' pnpm db:migrate
```

The second command applies the Prisma migrations to the isolated test database. Set `TEST_DATABASE_URL` to this test database URL before running the destructive integration suite. Integration tests delete rows and will refuse to run against a database that does not end in `_test` or `_testing`.

### 3. Provision the first administrator

```bash
pnpm db:bootstrap
```

The command prints a cryptographically random, one-time setup token in the terminal. It does **not** configure a username or password and does not put the token in the setup URL. Open the printed `/setup` URL, enter the token manually, and choose your username, display name and password.

The setup token expires. If it is lost or deliberately needs replacement before setup is complete, use the explicit operator action:

```bash
pnpm db:bootstrap:rotate
```

This invalidates the previous pending token. It refuses to reopen setup after an administrator has been created.

### 4. Run web and API

```bash
pnpm dev:api:web
```

Or run individually:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:mobile
```

Default URLs: web `http://localhost:3000`, setup `http://localhost:3000/setup`, API docs `http://localhost:4000/api/docs`, API readiness `http://localhost:4000/health/ready`.

For a physical phone, set `EXPO_PUBLIC_API_URL` to an API address reachable from that phone; `localhost` refers to the phone itself.

## Combined Docker deployment

Fill in database credentials and signing secrets in `.env`; use the real public HTTPS website origin for `NEXT_PUBLIC_APP_URL` in production.

```bash
# Apply schema migrations before starting the application.
docker compose --profile tools run --rm migrate

# Provision the one-time admin token; enter it manually on /setup.
docker compose --profile tools run --rm bootstrap

# Launch API + web behind one public web origin.
docker compose --profile combined up --build -d
```

To run just one application tier through Compose, use one of these profiles instead of `combined`:

```bash
# API + MySQL; no Next.js web container
docker compose --profile api up --build -d api

# Next.js web only; set COMPOSE_API_INTERNAL_URL in .env to an API
# address resolvable from inside the web container before running this command.
docker compose --profile web up --build -d web
```

By default Compose binds published ports to loopback, so a host reverse proxy can expose HTTPS without directly exposing the containers. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for deployment layouts and [docs/VERCEL_API.md](docs/VERCEL_API.md) for deploying the API to Vercel with MySQL and auto-derived origins.

## Tests and checks

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

The API integration suite covers bootstrap lockout, credential authentication, token eligibility, image submission, CRM operations, and concurrent single-use redemption. Set `TEST_DATABASE_URL` before running tests.

## API reference

Interactive Swagger UI: `/api/docs` on the API origin (or through the web proxy). OpenAPI 3.1 definition: [docs/openapi.yaml](docs/openapi.yaml). API endpoints are versioned under `/api/v1`.

## Repository hygiene

Commit source, tests, migrations, lockfile, documentation, and safe environment templates. Do not commit real `.env` files, one-time setup tokens, database dumps, or signing secrets.

## License

Private & Confidential — built for Devcon 2026.
