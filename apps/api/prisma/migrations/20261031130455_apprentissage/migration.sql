-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('KNOWLEDGE', 'SITUATION');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "draft_confidence" TEXT,
ADD COLUMN     "notion" TEXT,
ADD COLUMN     "review_note" TEXT;

-- CreateTable
CREATE TABLE "exam_template_quotas" (
    "id" SERIAL NOT NULL,
    "template_id" INTEGER NOT NULL,
    "topic_id" INTEGER NOT NULL,
    "kind" "QuestionKind" NOT NULL,
    "notion" TEXT,
    "count" INTEGER NOT NULL,

    CONSTRAINT "exam_template_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_question_states" (
    "visitor_hash" TEXT NOT NULL,
    "question_id" INTEGER NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "last_correct" BOOLEAN NOT NULL,
    "last_answered_at" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_question_states_pkey" PRIMARY KEY ("visitor_hash","question_id")
);

-- CreateTable
CREATE TABLE "glossary_terms" (
    "id" SERIAL NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,

    CONSTRAINT "glossary_terms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_template_quotas_template_id_idx" ON "exam_template_quotas"("template_id");

-- CreateIndex
CREATE INDEX "visitor_question_states_visitor_hash_due_at_idx" ON "visitor_question_states"("visitor_hash", "due_at");

-- CreateIndex
CREATE UNIQUE INDEX "glossary_terms_term_key" ON "glossary_terms"("term");

-- AddForeignKey
ALTER TABLE "exam_template_quotas" ADD CONSTRAINT "exam_template_quotas_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "exam_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_template_quotas" ADD CONSTRAINT "exam_template_quotas_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_question_states" ADD CONSTRAINT "visitor_question_states_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
