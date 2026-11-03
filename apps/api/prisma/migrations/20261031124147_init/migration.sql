-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('OFFICIAL_KNOWLEDGE', 'ORIGINAL_KNOWLEDGE', 'ORIGINAL_SITUATION');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('WRONG_ANSWER', 'UNCLEAR_STATEMENT', 'WRONG_SOURCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE "paths" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "licence" TEXT,
    "consulted_at" DATE,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "statement" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "topic_id" INTEGER NOT NULL,
    "statement_source_id" INTEGER,
    "answer_source_id" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "verified_at" DATE,
    "author" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_paths" (
    "question_id" INTEGER NOT NULL,
    "path_id" INTEGER NOT NULL,

    CONSTRAINT "question_paths_pkey" PRIMARY KEY ("question_id","path_id")
);

-- CreateTable
CREATE TABLE "exam_templates" (
    "id" SERIAL NOT NULL,
    "path_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "knowledge_count" INTEGER NOT NULL,
    "situation_count" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "pass_threshold" INTEGER NOT NULL,
    "regulatory_ref" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" UUID NOT NULL,
    "template_id" INTEGER NOT NULL,
    "visitor_hash" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "score" INTEGER,

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempt_questions" (
    "id" SERIAL NOT NULL,
    "attempt_id" UUID NOT NULL,
    "question_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "answer_order" INTEGER[],
    "answer_id" INTEGER,
    "answered_at" TIMESTAMP(3),
    "is_correct" BOOLEAN,

    CONSTRAINT "exam_attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_reports" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "message" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paths_code_key" ON "paths"("code");

-- CreateIndex
CREATE UNIQUE INDEX "paths_slug_key" ON "paths"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "topics_slug_key" ON "topics"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sources_key_key" ON "sources"("key");

-- CreateIndex
CREATE UNIQUE INDEX "questions_reference_key" ON "questions"("reference");

-- CreateIndex
CREATE INDEX "questions_status_type_idx" ON "questions"("status", "type");

-- CreateIndex
CREATE INDEX "questions_topic_id_idx" ON "questions"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "answers_question_id_position_key" ON "answers"("question_id", "position");

-- CreateIndex
CREATE INDEX "question_paths_path_id_idx" ON "question_paths"("path_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_templates_path_id_version_key" ON "exam_templates"("path_id", "version");

-- CreateIndex
CREATE INDEX "exam_attempts_visitor_hash_ended_at_idx" ON "exam_attempts"("visitor_hash", "ended_at");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempt_questions_attempt_id_position_key" ON "exam_attempt_questions"("attempt_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempt_questions_attempt_id_question_id_key" ON "exam_attempt_questions"("attempt_id", "question_id");

-- CreateIndex
CREATE INDEX "question_reports_status_idx" ON "question_reports"("status");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_statement_source_id_fkey" FOREIGN KEY ("statement_source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_answer_source_id_fkey" FOREIGN KEY ("answer_source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paths" ADD CONSTRAINT "question_paths_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_paths" ADD CONSTRAINT "question_paths_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_templates" ADD CONSTRAINT "exam_templates_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "exam_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_questions" ADD CONSTRAINT "exam_attempt_questions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_questions" ADD CONSTRAINT "exam_attempt_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_questions" ADD CONSTRAINT "exam_attempt_questions_answer_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
