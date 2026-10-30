-- CreateEnum
CREATE TYPE "SyllabusMaterialKind" AS ENUM ('SIGNED_SYLLABUS', 'TEXTBOOK', 'LECTURE_SLIDES', 'OTHER');

-- Existing files predate the kind and become OTHER; the default is dropped so every new upload must name one.
ALTER TABLE "SyllabusAttachment" ADD COLUMN "materialKind" "SyllabusMaterialKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "SyllabusAttachment" ALTER COLUMN "materialKind" DROP DEFAULT;
