-- Store an authenticated-encryption envelope alongside the one-way HMAC digest.
-- Existing codes remain redeemable but cannot be reprinted because the original plaintext
-- token was intentionally discarded before this migration.
ALTER TABLE `access_codes`
  ADD COLUMN `encrypted_token` VARCHAR(255) NULL;
