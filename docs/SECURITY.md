# Connect Me Security Model

This document records the security properties implemented today and the remaining decisions required before treating Connect Me as a hardened production system.

## Implemented controls

### Redeem/access codes

- Tokens contain 256 bits of cryptographically secure randomness.
- The raw token is returned only in the one-time code-generation response so the administrator can save/print the QR. It is not persisted in MySQL.
- New tokens are stored as HMAC-SHA-256(token, ACCESS_CODE_PEPPER) digests. The pepper is an independent secret stored in the API hosting environment, never in the database or frontend bundle.
- The public endpoint validates the presented token by computing its digest and atomically consumes an active, unexpired code in the same transaction as its contact submission.
- Code creation obtains createdByAdminId from the authenticated API principal, never from request input.
- Code listing, export, revoke, contact list/detail/update/image access, exports, and dashboard metrics are scoped to the authenticated administrator through the originating code's owner.
- A code submitted by a visitor does not grant that visitor access to the saved contact. Only the admin who created that code can retrieve the resulting contact.
- Existing legacy SHA-256 digests remain supported for compatibility. New codes always use the peppered HMAC format.

**Do not encrypt redeem tokens reversibly.** Connect Me only needs to compare a presented token; it does not need to recover the original value. A keyed digest is the appropriate storage format. Encryption would require storing/operating a decryption key and would turn a database plus key compromise into recoverable active links. The 256-bit token entropy and HMAC pepper protect the database-only compromise case. If a token is lost, generate a new code; the original token cannot be recovered from the database.

### Administrator authentication

- Passwords are stored using bcrypt hashes.
- Web access uses connectme_session in an HTTP-only cookie; web refresh uses the HTTP-only connectme_refresh cookie. Both are Secure in production and SameSite=Lax.
- Browser login/setup/refresh responses do not need a JavaScript-readable bearer JWT. Native mobile clients identify themselves with X-ConnectMe-Client: mobile and receive their access and refresh tokens in JSON.
- Access JWTs expire after 72 hours.
- Refresh tokens are random, stored as SHA-256 digests, expire after 7 days, and rotate on every successful refresh. Reuse of a revoked refresh token is treated as possible replay and revokes the account's remaining active refresh tokens.
- API authentication reloads the administrator from MySQL and rejects inactive or missing accounts.
- The landing page checks /auth/me and shows **Open Admin Dashboard** only when the session is valid; otherwise it shows **Login Now**. Expired web sessions attempt refresh before the request is retried.
- The same-origin Next.js proxy rejects state-changing requests marked cross-site and rejects an Origin that does not exactly match the website origin.

## Required production secrets

Set independent, randomly generated values for:

- SESSION_SECRET
- JWT_SECRET
- ACCESS_CODE_PEPPER

Each must be at least 32 characters. Keep them only in the API hosting environment/secret manager. Never set them as NEXT_PUBLIC_* or EXPO_PUBLIC_*. Keep the same ACCESS_CODE_PEPPER across API instances; changing it invalidates HMAC-based codes unless a planned multi-pepper verification/rotation strategy is implemented. Rotating SESSION_SECRET or JWT_SECRET invalidates the corresponding access sessions/tokens.

## Security decisions still to make

1. **Contact PII at rest.** Contact names, phone numbers, email, organization, notes, and image bytes are currently stored as ordinary database values. Managed-database/disk encryption helps against lost disks but does not protect a stolen SQL dump or an attacker with live database read access. Decide whether field-level encryption is required. It complicates search, partial matching, exports, and key rotation; keep encryption keys outside MySQL and separate from DATABASE_URL.
2. **Rate limiting and abuse controls.** Apply distributed limits at the edge/platform or through shared storage to login, refresh, setup, public code checks, and redemption. Per-process in-memory limits are not reliable across serverless or horizontally scaled instances. Also decide whether invalid public code attempts need bot challenges.
3. **Refresh/session policy.** Current refresh lifetime is sliding: every successful rotation issues a new token with a seven-day lifetime. Replaying a revoked token revokes all active refresh tokens for that admin. Decide whether an absolute session lifetime (for example, a maximum number of days since login) is also required.
4. **Admin privileges.** All admins are isolated from one another's codes and contacts. The initial admin can provision additional accounts but does not get implicit visibility into their data. Decide whether you need a separate, audited support/super-admin role; do not silently bypass owner filters.
5. **Audit trail.** Decide which security events must be retained: successful/failed logins, refresh replay, code creation/revocation/redemption, admin provisioning, exports, and changes to contact notes/status. Avoid logging passwords, raw access tokens, refresh tokens, setup tokens, or contact PII.
6. **Retention and deletion.** Define how long consumed/revoked codes, contact submissions, and uploaded images remain in MySQL, and how backups expire. A single-use code is not the same as automatic deletion of the contact it created.
7. **Lost or compromised credentials.** Define an operator procedure to deactivate an admin, revoke refresh sessions, rotate signing keys, and rotate the access-code pepper without accidentally exposing another admin's data.

## Security verification checklist

Before public launch, verify:

- [ ] Two different admins cannot list/export/revoke each other's codes.
- [ ] Two different admins cannot view, edit, export, or fetch images for each other's submissions.
- [ ] Redeeming one admin's code creates a submission visible only to that admin.
- [ ] The database stores HMAC digests, not raw access tokens.
- [ ] Web responses contain no bearer JWT; web cookies are HTTP-only, secure in production, and have the expected lifetimes.
- [ ] Mobile refresh returns a new access JWT and refresh token; replay of the old refresh token fails.
- [ ] Browser API requests refresh once after an expired access credential and retry using the rotated credential/cookies.
- [ ] Cross-site state-changing requests through the web proxy are rejected.
- [ ] Production logs contain no bearer credentials or submitted contact data.
- [ ] Production database backups and restoration are tested.
