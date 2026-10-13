-- Preserve the one-time administrator model at the database level.
-- PostgreSQL unique constraints allow multiple NULL values but only one TRUE value.
ALTER TABLE "admin_users" ADD COLUMN "is_initial_admin" BOOLEAN;
CREATE UNIQUE INDEX "admin_users_is_initial_admin_key" ON "admin_users"("is_initial_admin");
