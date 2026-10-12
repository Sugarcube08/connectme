# Connect Me — Development Guide & Status Log

> **Product Tagline:** *"You share. We connect."*  
> **Aesthetic Identity:** Royal Obsidian & Velvet Violet (Devcon Editorial Palette)

---

## 1. Current Implementation Status

Connect Me is structured as a **production-grade TypeScript monorepo** orchestrated via **pnpm workspaces** and **Turborepo**. The application is fully initialized, migrated, tested, and operational across all architectural layers.

```
connect-me/
├── apps/
│   ├── api/             # Express MVC REST API (Port 4000)
│   ├── web/             # Next.js 15 App Router Web Client (Port 3001)
│   └── mobile/          # React Native + Expo Admin Client
├── packages/
│   ├── contracts/       # Shared TypeScript DTOs, interfaces, and API envelope
│   ├── validation/      # Shared Zod validation schemas
│   ├── database/        # Prisma ORM schema, migrations, singleton client, bootstrap CLI
│   ├── api-client/      # Strongly-typed fetch API client for Web & Mobile
│   └── design-tokens/   # Devcon Obsidian Royal design tokens
└── docs/
    ├── openapi.yaml     # OpenAPI 3.1 specification (Mounted at /api/docs)
    └── decisions/       # Architecture Decision Records (ADR 001 - 010)
```

---

## 2. Completed Milestones

### Milestone 1: Workspace & Tooling Architecture
- [x] Initialized pnpm monorepo with Turborepo task pipelines (`build`, `test`, `typecheck`, `lint`, `dev`).
- [x] Configured TypeScript strict mode across all packages and apps with unified `tsconfig.base.json`.
- [x] Set up pnpm dependency links and approval of native build tools.

### Milestone 2: Relational Database & Managed Migrations
- [x] Provisioned PostgreSQL container (`connectme-postgres` on port `5432`).
- [x] Implemented Prisma schema (`packages/database/prisma/schema.prisma`) featuring:
  - `AdminUser`: Salted argon2/bcrypt password hash, bootstrap state flags.
  - `AccessCode`: 128-bit Base64URL cryptographic tokens stored as SHA-256 hashes with expiration, status enum (`ACTIVE`, `CONSUMED`, `REVOKED`, `EXPIRED`).
  - `ContactSubmission`: Attendee dossiers with `FollowUpStatus` tracking (`NEW`, `CONTACTED`, `REPLIED`, `OPPORTUNITY`, `ARCHIVED`).
  - `SubmissionImage`: Decoupled 1-to-1 table storing binary `BYTEA` images to prevent slow list scans.
  - `AppSetting`: Key-value application configurations.
- [x] Created and executed initial managed Prisma migration `20261012101903_init_schema`.
- [x] Engineered controlled first-admin bootstrap script (`pnpm db:bootstrap`) with zero hardcoded credentials and one-time token lockdown.

### Milestone 3: Express MVC Backend API (`apps/api`)
- [x] Architecture: Strict MVC separation (`controllers/`, `services/`, `repositories/`, `middleware/`, `errors/`, `serializers/`).
- [x] **Core Services**:
  - `TokenService`: Secure CSPRNG token generation (`crypto.randomBytes(16)`), SHA-256 token hashing, high-contrast QR generation.
  - `RedemptionService`: **Atomic single-use conditional updates** using PostgreSQL row locks inside `prisma.$transaction`. Guaranteed race-condition protection.
  - `ImageService`: Image sanitization using `sharp` — WebP normalization, auto-rotation, dimension constraints (max 1024x1024), 2MB limit.
  - `AuthService`: Bootstrap token verification, JWT issuance for mobile, and HTTP-only session cookies for web.
  - `ContactService` & `SettingsService`: Attendee CRM operations and brand configuration.
- [x] **Documentation & OpenAPI**: Complete OpenAPI 3.1 contract at `docs/openapi.yaml`, interactive Swagger UI mounted at `/api/docs`.
- [x] **Automated Testing Suite**: Vitest + Supertest integration tests covering 9 critical scenarios including 8-way concurrent race-condition redemptions.

### Milestone 4: Next.js Web Application (`apps/web`)
- [x] Completely decoupled architecture consuming the Express API via `@connectme/api-client`.
- [x] **Public Contact Submission (`/[token]`)**:
  - Validates token eligibility on load.
  - Mobile-first attendee submission form with friendly optional picture capture ("Take a quick picture so I remember you!").
  - Clear Devcon privacy disclosure and zero owner exposure.
  - Success screen: *"You're on my radar."*
  - Replay protection handling: Informative notice if code has already been redeemed.
- [x] **Controlled First-Time Setup (`/setup`)**: One-time bootstrap administrator account activation.
- [x] **Admin Authentication (`/admin/login`)**: Secure administrator login.
- [x] **Admin Dashboard (`/admin`)**: Metric tiles (Total, Active, Redeemed, Conversion Rate) and recent submissions feed.
- [x] **Codes Management (`/admin/codes`)**: Single and batch QR code generation, SVG/PNG modal view & download, printable cards view, CSV export, instant code revocation.
- [x] **Contacts CRM (`/admin/contacts`)**: Attendee list, search & status filter, detailed dossier view, inline follow-up status toggle, image view/delete, CSV export.
- [x] **Settings (`/admin/settings`)**: Public branding copy, default code lifespan, and privacy notice configuration.

### Milestone 5: React Native + Expo Mobile Client (`apps/mobile`)
- [x] Built with Expo Router and Native components.
- [x] Authenticated state backed by `expo-secure-store` and `mobileApiClient`.
- [x] Mobile Screens:
  - `app/login.tsx`: Administrator login screen.
  - `app/(tabs)/index.tsx`: Real-time Devcon overview and metrics dashboard.
  - `app/(tabs)/codes.tsx`: On-the-go QR generation and code status inspection.
  - `app/(tabs)/contacts.tsx`: Attendee dossiers with phone/email shortcuts and follow-up status switcher.
  - `app/(tabs)/settings.tsx`: Administrator profile view, event branding settings, and secure sign-out.

---

## 3. Environment Configuration

### Root `.env` / `apps/api/.env`
```env
# Server
PORT=4000
NODE_ENV=development
INITIAL_ADMIN_USERNAME=harsh
SESSION_SECRET=devcon-obsidian-royal-session-secret-32-chars-minimum
JWT_SECRET=devcon-obsidian-royal-jwt-secret-key-32-chars-minimum
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
QR_CANONICAL_ORIGIN=http://localhost:3001

# PostgreSQL
DATABASE_URL=postgres://postgres:postgres@localhost:5432/connectme

# Limits
MAX_IMAGE_SIZE_BYTES=2097152
MAX_BATCH_CODE_COUNT=100
```

### Web `.env` (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
PORT=3001
```

### Mobile Configuration (`apps/mobile/.env` or Expo env)
```env
EXPO_PUBLIC_API_URL=http://localhost:4000
```

---

## 4. Commands to Run & Operate

### Dependency Installation & Building
```bash
# Install all dependencies across the monorepo
pnpm install

# Build all packages and applications (Turborepo)
pnpm build

# Type check all workspaces
pnpm typecheck
```

### Database Management
```bash
# Generate Prisma Client
pnpm db:generate

# Apply pending Prisma migrations
pnpm db:migrate

# Provision initial admin with a one-time bootstrap token
pnpm db:bootstrap
```

### Running Services
```bash
# Run Express API (Port 4000)
pnpm dev:api

# Run Next.js Web App (Port 3001)
pnpm dev:web

# Run Mobile Client (Expo)
pnpm dev:mobile

# Run API and Web concurrently
pnpm dev
```

### Automated Testing
```bash
# Run Vitest API test suite (9 test cases including concurrency tests)
pnpm test
```

---

## 5. Test Results Summary

Test suite: `apps/api/src/tests/api.test.ts` (Vitest v3.2.7)
- `GET /health/live` returns 200 OK — **PASSED**
- `GET /health/ready` confirms PostgreSQL connection — **PASSED**
- Provision pending administrator with one-time token — **PASSED**
- Complete first-admin bootstrap and lock setup route permanently — **PASSED**
- Authenticate administrator with password and issue JWT — **PASSED**
- Generate single code and verify public eligibility — **PASSED**
- Atomically redeem code with profile image and burn single-use token — **PASSED**
- **Strictly at most one redemption succeeds under 8 concurrent requests** — **PASSED**
- Admin view contact list, retrieve image, and update status — **PASSED**

---

## 6. Known Issues & Operational Considerations
- Port `3000` is currently reserved by other local environment services; Next.js is configured by default on port `3001`.
- Android emulators require `10.0.2.2:4000` to reach the host API instead of `localhost:4000`. This mapping is preconfigured in `apps/mobile/lib/api.ts`.

---

## 7. Next Implementation Milestones
- [ ] Export batch QR codes as printable sheet PDF layout (e.g. 10 per A4 page).
- [ ] Optional webhook notification to Discord or Telegram when a new contact is submitted at Devcon.
- [ ] Offline-first queueing for the Expo mobile app for low-connectivity convention center environments.
