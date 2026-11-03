-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "sales_terms_accepted_at" TIMESTAMP(3),
ADD COLUMN     "sales_terms_version" TEXT;
