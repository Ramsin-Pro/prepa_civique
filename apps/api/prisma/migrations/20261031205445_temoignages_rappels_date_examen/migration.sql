-- CreateEnum
CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "entitlements" ADD COLUMN     "expiry_notice_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "exam_date" DATE,
ADD COLUMN     "last_reminder_at" TIMESTAMP(3),
ADD COLUMN     "reminder_opt_in_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "path_code" TEXT,
    "text" TEXT NOT NULL,
    "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING',
    "consent_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "testimonials_user_id_key" ON "testimonials"("user_id");

-- CreateIndex
CREATE INDEX "testimonials_status_idx" ON "testimonials"("status");

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
