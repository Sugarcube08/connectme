-- Initial MySQL schema for Connect Me.
-- Initial MySQL schema baseline corresponding to schema.prisma; apply only to a fresh MySQL database.
-- Existing PostgreSQL databases are not compatible with this migration history.

CREATE TABLE `admin_users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `display_name` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_bootstrap_pending` BOOLEAN NOT NULL DEFAULT true,
    `is_initial_admin` BOOLEAN NULL,
    `bootstrap_token_hash` VARCHAR(191) NULL,
    `bootstrap_expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    UNIQUE INDEX `admin_users_username_key`(`username`),
    UNIQUE INDEX `admin_users_is_initial_admin_key`(`is_initial_admin`),
    UNIQUE INDEX `admin_users_bootstrap_token_hash_key`(`bootstrap_token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `access_codes` (
    `id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'CONSUMED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,
    `consumed_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    UNIQUE INDEX `access_codes_token_hash_key`(`token_hash`),
    INDEX `access_codes_token_hash_idx`(`token_hash`),
    INDEX `access_codes_status_idx`(`status`),
    INDEX `access_codes_created_at_idx`(`created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `contact_submissions` (
    `id` VARCHAR(191) NOT NULL,
    `access_code_id` VARCHAR(191) NOT NULL,
    `full_name` VARCHAR(191) NOT NULL,
    `phone_number` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `organization` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `profile_url` VARCHAR(191) NULL,
    `discussion_notes` TEXT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `follow_up_status` ENUM('NEW', 'CONTACTED', 'REPLIED', 'OPPORTUNITY', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
    UNIQUE INDEX `contact_submissions_access_code_id_key`(`access_code_id`),
    INDEX `contact_submissions_submitted_at_idx`(`submitted_at` DESC),
    INDEX `contact_submissions_follow_up_status_idx`(`follow_up_status`),
    INDEX `contact_submissions_full_name_idx`(`full_name`),
    PRIMARY KEY (`id`),
    CONSTRAINT `contact_submissions_access_code_id_fkey`
      FOREIGN KEY (`access_code_id`) REFERENCES `access_codes`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `submission_images` (
    `id` VARCHAR(191) NOT NULL,
    `contact_submission_id` VARCHAR(191) NOT NULL,
    `profile_image` LONGBLOB NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `submission_images_contact_submission_id_key`(`contact_submission_id`),
    PRIMARY KEY (`id`),
    CONSTRAINT `submission_images_contact_submission_id_fkey`
      FOREIGN KEY (`contact_submission_id`) REFERENCES `contact_submissions`(`id`)
      ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;

CREATE TABLE `app_settings` (
    `key` VARCHAR(191) NOT NULL,
    `value` JSON NOT NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB;
