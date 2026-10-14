-- Record which administrator created each admin account
ALTER TABLE `admin_users`
  ADD COLUMN `created_by_id` VARCHAR(191) NULL;

CREATE INDEX `admin_users_created_by_id_idx`
  ON `admin_users`(`created_by_id`);

ALTER TABLE `admin_users`
  ADD CONSTRAINT `admin_users_created_by_id_fkey`
  FOREIGN KEY (`created_by_id`) REFERENCES `admin_users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
