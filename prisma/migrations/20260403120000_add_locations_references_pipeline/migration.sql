-- AlterEnum
ALTER TYPE "PipelineStep" ADD VALUE 'reference_generation';

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "referenceImageUrl" TEXT,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Character
ALTER TABLE "Character" ADD COLUMN "referenceImageUrl" TEXT;

-- AlterTable: Scene
ALTER TABLE "Scene" ADD COLUMN "negativePrompt" TEXT;
ALTER TABLE "Scene" ADD COLUMN "locationId" TEXT;

-- AlterTable: WorkflowExecution
ALTER TABLE "WorkflowExecution" ADD COLUMN "analysisPayload" JSONB;

-- CreateIndex
CREATE INDEX "Location_projectId_idx" ON "Location"("projectId");

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
