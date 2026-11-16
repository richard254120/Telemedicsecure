-- AlterEnum
ALTER TYPE "AccessGrantStatus" ADD VALUE IF NOT EXISTS 'BURNED';

-- AlterTable
ALTER TABLE "AccessGrant" ADD COLUMN IF NOT EXISTS "burnedAt" TIMESTAMP(3);
