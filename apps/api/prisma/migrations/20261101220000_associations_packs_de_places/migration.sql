-- CreateEnum
CREATE TYPE "PlanAudience" AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "OrganizationRequestStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "exam_follow_up_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "activation_days" INTEGER,
ADD COLUMN     "audience" "PlanAudience" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "seats" INTEGER;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "organization_id" UUID,
ALTER COLUMN "waiver_accepted_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "entitlements" ADD COLUMN     "extended_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "city" TEXT,
    "registration" TEXT,
    "contact_name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PENDING',
    "invite_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_licenses" (
    "id" SERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID,
    "seats" INTEGER NOT NULL,
    "seat_days" INTEGER NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" SERIAL NOT NULL,
    "organization_id" UUID NOT NULL,
    "license_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "entitlement_id" INTEGER NOT NULL,
    "share_progress_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_requests" (
    "id" SERIAL NOT NULL,
    "organization_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "city" TEXT,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "seats" INTEGER NOT NULL,
    "wish" TEXT NOT NULL,
    "message" TEXT,
    "status" "OrganizationRequestStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_invite_code_key" ON "organizations"("invite_code");

-- CreateIndex
CREATE INDEX "organizations_owner_id_idx" ON "organizations"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_licenses_order_id_key" ON "organization_licenses"("order_id");

-- CreateIndex
CREATE INDEX "organization_licenses_organization_id_idx" ON "organization_licenses"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_entitlement_id_key" ON "organization_members"("entitlement_id");

-- CreateIndex
CREATE INDEX "organization_members_license_id_idx" ON "organization_members"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "organization_requests_status_idx" ON "organization_requests"("status");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_licenses" ADD CONSTRAINT "organization_licenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_licenses" ADD CONSTRAINT "organization_licenses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "organization_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_entitlement_id_fkey" FOREIGN KEY ("entitlement_id") REFERENCES "entitlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

