-- CreateEnum
CREATE TYPE "CodeStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'REVOKED');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('NEW', 'CONTACTED', 'REPLIED', 'OPPORTUNITY', 'ARCHIVED');

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_bootstrap_pending" BOOLEAN NOT NULL DEFAULT true,
    "bootstrap_token_hash" TEXT,
    "bootstrap_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_codes" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "label" TEXT,
    "status" "CodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "access_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" TEXT NOT NULL,
    "access_code_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "email" TEXT,
    "organization" TEXT,
    "role" TEXT,
    "profile_url" TEXT,
    "discussion_notes" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "follow_up_status" "FollowUpStatus" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_images" (
    "id" TEXT NOT NULL,
    "contact_submission_id" TEXT NOT NULL,
    "profile_image" BYTEA NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_bootstrap_token_hash_key" ON "admin_users"("bootstrap_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "access_codes_token_hash_key" ON "access_codes"("token_hash");

-- CreateIndex
CREATE INDEX "access_codes_token_hash_idx" ON "access_codes"("token_hash");

-- CreateIndex
CREATE INDEX "access_codes_status_idx" ON "access_codes"("status");

-- CreateIndex
CREATE INDEX "access_codes_created_at_idx" ON "access_codes"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "contact_submissions_access_code_id_key" ON "contact_submissions"("access_code_id");

-- CreateIndex
CREATE INDEX "contact_submissions_submitted_at_idx" ON "contact_submissions"("submitted_at" DESC);

-- CreateIndex
CREATE INDEX "contact_submissions_follow_up_status_idx" ON "contact_submissions"("follow_up_status");

-- CreateIndex
CREATE INDEX "contact_submissions_full_name_idx" ON "contact_submissions"("full_name");

-- CreateIndex
CREATE UNIQUE INDEX "submission_images_contact_submission_id_key" ON "submission_images"("contact_submission_id");

-- AddForeignKey
ALTER TABLE "contact_submissions" ADD CONSTRAINT "contact_submissions_access_code_id_fkey" FOREIGN KEY ("access_code_id") REFERENCES "access_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_images" ADD CONSTRAINT "submission_images_contact_submission_id_fkey" FOREIGN KEY ("contact_submission_id") REFERENCES "contact_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
