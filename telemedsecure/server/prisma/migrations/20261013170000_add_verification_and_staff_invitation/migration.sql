-- CreateEnum safely
DO $$ BEGIN
    CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable safely
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "verificationStatus" "VerificationStatus",
ADD COLUMN IF NOT EXISTS "medicalLicenseNo" TEXT,
ADD COLUMN IF NOT EXISTS "licenseJurisdiction" TEXT,
ADD COLUMN IF NOT EXISTS "specialty" TEXT,
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;

UPDATE "User" SET "verificationStatus" = 'VERIFIED' WHERE "verificationStatus" IS NULL;

ALTER TABLE "User" ALTER COLUMN "verificationStatus" SET DEFAULT 'VERIFIED';
ALTER TABLE "User" ALTER COLUMN "verificationStatus" SET NOT NULL;

-- CreateTable StaffInvitation safely
CREATE TABLE IF NOT EXISTS "StaffInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex safely
CREATE UNIQUE INDEX IF NOT EXISTS "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");

-- AddForeignKey safely
DO $$ BEGIN
    ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
