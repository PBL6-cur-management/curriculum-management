-- Demo accounts only: lets one visitor walk the whole approval flow (prisma/demo-account.ts).
ALTER TABLE "User" ADD COLUMN "canSelfApprove" BOOLEAN NOT NULL DEFAULT false;
