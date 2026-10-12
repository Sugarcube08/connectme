# CONNECT ME

> *"You share. We connect."*

Connect Me is a lightweight, single-use QR-code contact collection and professional networking platform designed for high-density tech conferences like **Devcon**.

Physical business cards printed with unique, cryptographically unpredictable QR codes are handed to attendees. When scanned, attendees submit their contact details through a lightweight mobile browser interface. The owner reviews all submissions, takes notes, and initiates follow-ups via the web dashboard or native mobile app.

---

## 🛡️ Critical Product Rule: Zero Owner Exposure

**Connect Me collects other people's contact information so that the owner can reach out to them.**

- The platform **never** displays the owner's phone number, email address, vCard, social links, or personal identity on any public screen.
- There is no reciprocal contact exchange.
- There is no public attendee directory or discovery mechanism.
- Attendees are never asked to install an app or register an account.

---

## 🏛️ Architecture Overview

The codebase is structured as a TypeScript monorepo orchestrated with **pnpm workspaces** and **Turborepo**:

```
connect-me/
├── apps/
│   ├── api/             # Express.js MVC REST API (Authoritative backend)
│   ├── web/             # Next.js 15 App Router (Public forms & Admin dashboard)
│   └── mobile/          # React Native + Expo (On-the-go admin app)
├── packages/
│   ├── contracts/       # Shared DTOs, API envelopes, and status enums
│   ├── validation/      # Shared Zod schemas for runtime payload safety
│   ├── database/        # PostgreSQL schema, Prisma migrations & bootstrap CLI
│   ├── api-client/      # Strongly-typed fetch API client for Web & Mobile
│   └── design-tokens/   # Devcon Obsidian Royal design palette & tokens
└── docs/
    ├── openapi.yaml     # OpenAPI 3.1 specification
    └── decisions/       # Architecture Decision Records (ADR-001 through ADR-010)
```

### Key Architectural Decisions
1. **MVC Express API (`apps/api`)**: The single source of truth for business logic and data persistence.
2. **PostgreSQL & Prisma (`packages/database`)**: Schema versioning managed via declarative Prisma migrations (`packages/database/prisma/migrations`).
3. **Decoupled Binary Storage**: Optional profile photos are stored in a dedicated `submission_images` table (`BYTEA`) so that list queries for attendee dossiers remain fast and lightweight.
4. **Atomic Single-Use Invalidation**: Token redemptions run inside an isolated PostgreSQL transaction using conditional row updates (`status = 'ACTIVE' -> 'CONSUMED'`), ensuring strictly at most one redemption succeeds even under heavy concurrent replay attempts.
5. **Zero Hardcoded Secrets**: First-admin account creation uses a cryptographically unpredictable bootstrap token generated at deployment time (`pnpm db:bootstrap`).

---

## 🎨 Visual Identity

Connect Me departs from standard green-tinted office dashboards and adopts a dark, royal Devcon-inspired aesthetic:
- **Obsidian Dark** (`#0B0B10` / `#13121C`)
- **Royal Velvet** (`#6D3CE8` / `#7E4DF5`)
- **Warm Ivory** (`#F3EFE7`)
- **Metallic Gold** (`#C8A96B`)
- **Slate Violet** (`#A5A4B2` / `#777681`)

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v20.x or v22.x+
- **pnpm** v9+ or v12+
- **Docker** (or local PostgreSQL instance on port `5432`)

### 1. Database Setup
Start the local PostgreSQL container:
```bash
docker run --name connectme-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=connectme -p 5432:5432 -d postgres:16-alpine
```

### 2. Install Dependencies & Build
```bash
pnpm install
pnpm build
```

### 3. Run Migrations & Bootstrap Initial Administrator
```bash
# Run managed Prisma migration
pnpm db:migrate

# Provision the initial administrator account
pnpm db:bootstrap
```
The bootstrap command will print a one-time bootstrap setup token:
```text
============================================================
CONNECT ME FIRST-ADMIN BOOTSTRAP PROVISIONED
============================================================
Admin Username   : harsh
Bootstrap Token  : <ONE_TIME_BOOTSTRAP_TOKEN>
Setup URL        : http://localhost:3001/setup?token=<TOKEN>
============================================================
```

### 4. Start Development Servers
```bash
# Start Express API (Port 4000)
pnpm dev:api

# Start Next.js Web App (Port 3001)
pnpm dev:web

# Or run both simultaneously
pnpm dev
```

### 5. Access Interfaces
- **First-Time Admin Setup**: `http://localhost:3001/setup`
- **Admin Web Dashboard**: `http://localhost:3001/admin`
- **Interactive Swagger Docs**: `http://localhost:4000/api/docs`
- **API Health Check**: `http://localhost:4000/health/ready`

---

## 📱 Mobile Admin App (Expo)

To start the Expo mobile client:
```bash
pnpm dev:mobile
```
- For **Web preview**, press `w` in the terminal.
- For **Android emulator**, press `a`.
- For **iOS simulator**, press `i`.

---

## 🧪 Testing & Verification

Run the test suite:
```bash
pnpm test
```
The automated test suite verifies:
- Liveness and database readiness endpoints.
- Bootstrap setup workflow and permanent route locking.
- Password authentication and JWT token issuance.
- Cryptographic token generation and public eligibility verification.
- **Single-use redemption under 8 simultaneous concurrent requests** (strictly 1 success, 7 conflicts).
- Attendee contact management, image retrieval, and follow-up status lifecycle.

---

## 📖 API Documentation

Interactive Swagger documentation is available at `http://localhost:4000/api/docs` and based on the OpenAPI 3.1 specification at [docs/openapi.yaml](file:///home/sugarcube/Documents/Documents/Code-Server/Projects/connectme/docs/openapi.yaml).

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/health/live` | Container liveness check | Public |
| `GET` | `/health/ready` | Database readiness check | Public |
| `GET` | `/api/v1/public/codes/:token` | Check QR code eligibility | Public |
| `POST` | `/api/v1/public/codes/:token/redeem` | Submit attendee contact info | Public |
| `POST` | `/api/v1/auth/bootstrap/setup` | First-time admin password setup | Bootstrap Token |
| `POST` | `/api/v1/auth/login` | Administrator login | Public |
| `POST` | `/api/v1/auth/logout` | Administrator logout | Session / Bearer |
| `GET` | `/api/v1/admin/dashboard` | Key metrics and recent submissions | Admin |
| `POST` | `/api/v1/admin/codes` | Generate single or batch QR codes | Admin |
| `POST` | `/api/v1/admin/codes/:id/revoke` | Revoke active access code | Admin |
| `GET` | `/api/v1/admin/contacts` | List and filter attendee contacts | Admin |
| `GET` | `/api/v1/admin/contacts/:id/image` | Retrieve attendee profile photo | Admin |
| `PATCH` | `/api/v1/admin/contacts/:id` | Update follow-up status or notes | Admin |
| `GET` | `/api/v1/admin/settings` | Get public branding & event settings | Admin |
| `PATCH` | `/api/v1/admin/settings` | Update event name & privacy notice | Admin |

---

## 📜 License
Private & Confidential — Built for Devcon 2026.
