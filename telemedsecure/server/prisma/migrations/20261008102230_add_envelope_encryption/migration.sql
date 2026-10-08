/*
  Warnings:

  - Added the required column `dekAuthTag` to the `MedicalRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dekIv` to the `MedicalRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedDek` to the `MedicalRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dekAuthTag` to the `VitalSign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dekIv` to the `VitalSign` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedDek` to the `VitalSign` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "dekAuthTag" TEXT,
ADD COLUMN     "dekIv" TEXT,
ADD COLUMN     "encryptedDek" TEXT;

-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN     "dekAuthTag" TEXT NOT NULL,
ADD COLUMN     "dekIv" TEXT NOT NULL,
ADD COLUMN     "encryptedDek" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "VitalSign" ADD COLUMN     "dekAuthTag" TEXT NOT NULL,
ADD COLUMN     "dekIv" TEXT NOT NULL,
ADD COLUMN     "encryptedDek" TEXT NOT NULL;
