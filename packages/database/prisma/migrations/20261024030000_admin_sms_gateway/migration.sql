-- AlterTable admin_users to add per-admin SMS Gateway configuration
ALTER TABLE `admin_users`
  ADD COLUMN `sms_enabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `sms_gateway_url` VARCHAR(500) NULL,
  ADD COLUMN `sms_gateway_username` VARCHAR(191) NULL,
  ADD COLUMN `sms_gateway_password` TEXT NULL,
  ADD COLUMN `sms_template` TEXT NULL,
  ADD COLUMN `sms_sender_phone` VARCHAR(50) NULL,
  ADD COLUMN `sms_sender_email` VARCHAR(191) NULL;
