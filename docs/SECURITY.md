# Connect Me Security Model

This document records the security properties implemented today and the remaining decisions required before treating Connect Me as a hardened production system.

## Implemented controls

### Redeem/access codes

- Tokens contain 256 bits of cryptographically secure randomness.
- Tokens contain 256 bits of random entropy. A one-way HMAC-SHA-256(token, ACCESS_CODE_PEPPER) digest is the lookup/verification value.
- New tokens also have an AES-256-GCM authenticated-encryption envelope in MySQL, using an independent `ACCESS_CODE_ENCRYPTION_KEY` that is held only in the API secret manager. This second representation permits an authenticated owner to reprint a still-active QR without storing plaintext tokens in the database.
- The normal list/export APIs never return token plaintext or the encrypted envelope. The dedicated print-assets endpoint verifies code ownership first, allows only active/non-expired codes, decrypts in memory, returns private no-store responses, and is authenticated as the owning admin.
- Keep the HMAC pepper and AES-GCM key out of MySQL, source control, logs, and frontend bundles. A database-only leak should not yield redeemable plaintext tokens; compromise of both the database and application secrets is a different threat model.
- The public endpoint validates the presented token by computing its digest and atomically consumes an active, unexpired code in the same transaction as its contact submission.
- Code creation obtains createdByAdminId from the authenticated API principal, never from request input.
- Code listing, export, revoke, contact list/detail/update/image access, exports, and dashboard metrics are scoped to the authenticated administrator through the originating code's owner.
- A code submitted by a visitor does not grant that visitor access to the saved contact. Only the admin who created that code can retrieve the resulting contact.
- Existing legacy SHA-256 digests remain supported for compatibility. New codes always use the peppered HMAC format.

The HMAC digest remains the value used to verify visitor-supplied tokens; the encrypted envelope exists only because admins explicitly need a controlled way to reprint an existing active code. AES-256-GCM authenticates the envelope, and the independent key is not stored alongside the ciphertext in MySQL. Do not expose a general token-decryption endpoint: decryption must stay behind owner checks and active/expiry checks. Codes created before the encrypted envelope migration have no ciphertext and cannot be reprinted, because a one-way digest cannot be inverted; create replacement codes for new cards.

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
- ACCESS_CODE_ENCRYPTION_KEY

`SESSION_SECRET`, `JWT_SECRET`, and `ACCESS_CODE_PEPPER` must each be at least 32 characters. `ACCESS_CODE_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters (32 random bytes). Keep all four only in the API hosting environment/secret manager. Never set them as `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`. Keep `ACCESS_CODE_PEPPER` stable across API instances; changing it invalidates HMAC-based codes unless a planned multi-pepper verification/rotation strategy is implemented. Keep `ACCESS_CODE_ENCRYPTION_KEY` stable and securely backed up; losing it prevents QR reprinting for encrypted records although digest verification/redemption can still work. Key rotation for encrypted envelopes needs a planned decrypt-with-old / re-encrypt-with-new maintenance process; that workflow is not automated yet. Rotating `SESSION_SECRET` or `JWT_SECRET` invalidates the corresponding access sessions/tokens.

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
- [ ] The database stores HMAC digests and authenticated encrypted envelopes, not raw access tokens or decryption keys.
- [ ] Reprint assets are returned only to the authenticated owning admin, only for active/non-expired codes, with cache disabled.
- [ ] Web responses contain no bearer JWT; web cookies are HTTP-only, secure in production, and have the expected lifetimes.
- [ ] Mobile refresh returns a new access JWT and refresh token; replay of the old refresh token fails.
- [ ] Browser API requests refresh once after an expired access credential and retry using the rotated credential/cookies.
- [ ] Cross-site state-changing requests through the web proxy are rejected.
- [ ] Production logs contain no bearer credentials or submitted contact data.
- [ ] Production database backups and restoration are tested.
