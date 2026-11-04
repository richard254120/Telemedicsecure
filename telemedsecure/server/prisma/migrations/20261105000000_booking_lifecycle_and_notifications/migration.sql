-- Booking lifecycle, persistent notifications, and role-agnostic access grants.
--
-- Postgres note: ALTER TYPE ... ADD VALUE is allowed inside this migration's
-- transaction as long as the new label is not referenced by any other statement
-- here. It isn't — application code supplies the status explicitly on insert.

-- AlterEnum: ConsultationStatus gains the accept/decline workflow states
ALTER TYPE "ConsultationStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ConsultationStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "ConsultationStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

-- CreateEnum: NotificationType
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CREATED', 'BOOKING_ACCEPTED', 'BOOKING_DECLINED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'ACCESS_GRANTED', 'ACCESS_REVOKED', 'CHAT_MESSAGE', 'GENERIC');

-- AlterTable: Consultation booking-lifecycle columns (accept/decline/reschedule/cancel)
ALTER TABLE "Consultation" ADD COLUMN "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Consultation" ADD COLUMN "declineReason" TEXT;
ALTER TABLE "Consultation" ADD COLUMN "rescheduledFrom" TIMESTAMP(3);
ALTER TABLE "Consultation" ADD COLUMN "rescheduledById" TEXT;
ALTER TABLE "Consultation" ADD COLUMN "rescheduledAt" TIMESTAMP(3);
ALTER TABLE "Consultation" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Consultation" ADD COLUMN "cancelledById" TEXT;
ALTER TABLE "Consultation" ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- AlterTable: AccessGrant becomes role-agnostic (doctorId -> granteeId) + role snapshot
ALTER TABLE "AccessGrant" RENAME COLUMN "doctorId" TO "granteeId";
ALTER TABLE "AccessGrant" ADD COLUMN "granteeRole" TEXT;
ALTER INDEX "AccessGrant_doctorId_status_idx" RENAME TO "AccessGrant_granteeId_status_idx";
ALTER TABLE "AccessGrant" RENAME CONSTRAINT "AccessGrant_doctorId_fkey" TO "AccessGrant_granteeId_fkey";

-- CreateTable: Notification (persisted, per-user; also pushed live over socket)
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "consultationId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
