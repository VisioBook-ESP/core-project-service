-- AlterTable: Scene - add dialogue/audio fields
ALTER TABLE "Scene" ADD COLUMN "sceneType" TEXT;
ALTER TABLE "Scene" ADD COLUMN "audioPrompt" TEXT;
ALTER TABLE "Scene" ADD COLUMN "narrationText" TEXT;

-- AlterTable: Character - add voice description
ALTER TABLE "Character" ADD COLUMN "voiceDescription" TEXT;

-- CreateTable: Dialogue
CREATE TABLE "Dialogue" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "sceneId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "speaker" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "delivery" TEXT NOT NULL DEFAULT 'neutral',
    "context" TEXT,

    CONSTRAINT "Dialogue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dialogue_sceneId_idx" ON "Dialogue"("sceneId");
CREATE INDEX "Dialogue_projectId_idx" ON "Dialogue"("projectId");

-- AddForeignKey
ALTER TABLE "Dialogue" ADD CONSTRAINT "Dialogue_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dialogue" ADD CONSTRAINT "Dialogue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
