import { PrismaClient } from '@prisma/client';
import { encryptDataEnvelope, decryptDataEnvelope } from '../src/utils/crypto';
import crypto from 'crypto';

const prisma = new PrismaClient();

describe('Envelope Encryption', () => {
  let recordId: string;
  const plaintextData = JSON.stringify({ diagnosis: 'Common Cold', notes: 'Rest and hydration' });

  beforeAll(async () => {
    // Seed a fake patient if missing
    const user = await prisma.user.create({
      data: { email: `test-${Date.now()}@example.com`, passwordHash: 'hash', firstName: 'Test', lastName: 'Patient', role: 'PATIENT' }
    });

    const { encryptedDek, dekIv, dekAuthTag, ciphertext, iv, authTag } = encryptDataEnvelope(plaintextData);

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: user.id,
        encryptedData: ciphertext,
        dataIv: iv,
        dataAuthTag: authTag,
        encryptedDek,
        dekIv,
        dekAuthTag
      }
    });

    recordId = record.id;
  });

  afterAll(async () => {
    await prisma.medicalRecord.delete({ where: { id: recordId } });
    await prisma.$disconnect();
  });

  it('should store only ciphertext in the database', async () => {
    // We fetch the raw record using raw SQL to ensure Prisma isn't magically decrypting it
    const rawRecords: any[] = await prisma.$queryRaw`SELECT "encryptedData" FROM "MedicalRecord" WHERE id = ${recordId}::text`;
    
    expect(rawRecords.length).toBe(1);
    expect(rawRecords[0].encryptedData).toBeDefined();
    expect(rawRecords[0].encryptedData).not.toContain('Common Cold');
    expect(rawRecords[0].encryptedData).not.toContain('diagnosis');
  });

  it('should be able to decrypt the data perfectly', async () => {
    const record = await prisma.medicalRecord.findUnique({ where: { id: recordId } });
    expect(record).toBeDefined();

    const decrypted = decryptDataEnvelope(
      record!.encryptedData,
      record!.dataIv,
      record!.dataAuthTag,
      record!.encryptedDek,
      record!.dekIv,
      record!.dekAuthTag
    );

    expect(decrypted).toBe(plaintextData);
  });
});
