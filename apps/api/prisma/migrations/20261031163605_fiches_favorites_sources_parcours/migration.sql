-- AlterTable
ALTER TABLE "content_pages" ADD COLUMN     "published_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "paths" ADD COLUMN     "sources" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "verified_at" DATE;

-- AlterTable
ALTER TABLE "revision_sheets" ADD COLUMN     "published_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sheet_favorites" (
    "learner_key" TEXT NOT NULL,
    "sheet_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sheet_favorites_pkey" PRIMARY KEY ("learner_key","sheet_id")
);

-- AddForeignKey
ALTER TABLE "sheet_favorites" ADD CONSTRAINT "sheet_favorites_sheet_id_fkey" FOREIGN KEY ("sheet_id") REFERENCES "revision_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
