-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "totpSecret" TEXT;
