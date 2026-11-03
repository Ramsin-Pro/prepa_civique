-- CreateTable
CREATE TABLE "visitor_favorites" (
    "visitor_hash" TEXT NOT NULL,
    "question_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_favorites_pkey" PRIMARY KEY ("visitor_hash","question_id")
);

-- AddForeignKey
ALTER TABLE "visitor_favorites" ADD CONSTRAINT "visitor_favorites_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
