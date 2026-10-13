-- Scope access codes to their creator and introduce revocable rotating refresh tokens.
-- This is additive and safe to apply over the current MySQL baseline.
ALTER TABLE `access_codes`
  ADD COLUMN `created_by_admin_id` VARCHAR(191) NULL;

-- Assign existing codes to the initial administrator when one is already provisioned.
-- If no initial admin exists yet, there cannot normally be legitimate admin-created codes.
UPDATE `access_codes` AS codes
JOIN `admin_users` AS admins ON admins.`is_initial_admin` = TRUE
SET codes.`created_by_admin_id` = admins.`id`
WHERE codes.`created_by_admin_id` IS NULL;

CREATE INDEX `access_codes_created_by_admin_id_created_at_idx`
  ON `access_codes`(`created_by_admin_id`, `created_at` DESC);

ALTER TABLE `access_codes`
  ADD CONSTRAINT `access_codes_created_by_admin_id_fkey`
  FOREIGN KEY (`created_by_admin_id`) REFERENCES `admin_users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `admin_refresh_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `admin_user_id` VARCHAR(191) NOT NULL,
  `token_hash` VARCHAR(191) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `admin_refresh_tokens_token_hash_key`(`token_hash`),
  INDEX `admin_refresh_tokens_admin_user_id_expires_at_idx`(`admin_user_id`, `expires_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `admin_refresh_tokens_admin_user_id_fkey`
    FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;
