-- CreateEnum
CREATE TYPE "DecisionRunStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "device_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_runs" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "context" TEXT,
    "goals" TEXT,
    "speed" TEXT NOT NULL,
    "time_unit" TEXT NOT NULL,
    "num_steps" INTEGER NOT NULL,
    "plan_rationale" TEXT NOT NULL,
    "status" "DecisionRunStatus" NOT NULL,
    "error_message" TEXT,
    "chosen_fork_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_options" (
    "id" UUID NOT NULL,
    "decision_run_id" UUID NOT NULL,
    "fork_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "summary" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_run_payloads" (
    "decision_run_id" UUID NOT NULL,
    "input_json" JSONB NOT NULL,
    "plan_json" JSONB NOT NULL,
    "timelines_json" JSONB NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_run_payloads_pkey" PRIMARY KEY ("decision_run_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_token_key" ON "devices"("device_token");

-- CreateIndex
CREATE INDEX "decision_runs_device_id_created_at_idx" ON "decision_runs"("device_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "decision_options_decision_run_id_sort_order_idx" ON "decision_options"("decision_run_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "decision_options_decision_run_id_fork_id_key" ON "decision_options"("decision_run_id", "fork_id");

-- AddForeignKey
ALTER TABLE "decision_runs" ADD CONSTRAINT "decision_runs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_options" ADD CONSTRAINT "decision_options_decision_run_id_fkey" FOREIGN KEY ("decision_run_id") REFERENCES "decision_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_run_payloads" ADD CONSTRAINT "decision_run_payloads_decision_run_id_fkey" FOREIGN KEY ("decision_run_id") REFERENCES "decision_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

