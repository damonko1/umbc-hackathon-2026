-- CreateEnum
CREATE TYPE "MemoryItemKind" AS ENUM ('decision_summary');

-- CreateEnum
CREATE TYPE "MemoryItemStatus" AS ENUM ('active', 'archived');

-- CreateTable
CREATE TABLE "memory_items" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "decision_run_id" UUID,
    "kind" "MemoryItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "chosen_fork_id" TEXT,
    "chosen_fork_label" TEXT,
    "status" "MemoryItemStatus" NOT NULL DEFAULT 'active',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "user_edited_title" BOOLEAN NOT NULL DEFAULT false,
    "user_edited_summary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memory_items_decision_run_id_key" ON "memory_items"("decision_run_id");

-- CreateIndex
CREATE INDEX "memory_items_device_id_status_pinned_updated_at_idx" ON "memory_items"("device_id", "status", "pinned", "updated_at" DESC);

-- AddForeignKey
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_items" ADD CONSTRAINT "memory_items_decision_run_id_fkey" FOREIGN KEY ("decision_run_id") REFERENCES "decision_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
