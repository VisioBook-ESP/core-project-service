-- AlterTable
ALTER TABLE "Project" DROP COLUMN IF EXISTS "sourceType";

-- DropEnum
DROP TYPE IF EXISTS "SourceType";
