-- Remove AES-256-GCM encryption and store token directly for instant link copying at any time.
ALTER TABLE `access_codes`
  ADD COLUMN `token` VARCHAR(64) NULL,
  DROP COLUMN `encrypted_token`;

CREATE UNIQUE INDEX `access_codes_token_key` ON `access_codes`(`token`);
CREATE INDEX `access_codes_token_idx` ON `access_codes`(`token`);
