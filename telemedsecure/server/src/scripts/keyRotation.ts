import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { decryptDataEnvelope, encryptDataEnvelope, generateDek, encryptDek, decryptDek } from '../utils/crypto';

// In a real system, you pass NEW_MASTER_KEY from env, re-encrypt DEKs without touching the actual ciphertext.
// This rotates the KEK.

const prisma = new PrismaClient();

async function rotateKek() {
  const newKek = crypto.scryptSync(process.env.NEW_MASTER_KEY || 'new-secret', 'salt', 32);

  // Example for MedicalRecords
  const records = await prisma.medicalRecord.findMany();
  
  for (const record of records) {
    // 1. Decrypt DEK using old KEK (which uses process.env.MASTER_KEY inside decryptDek)
    const dek = decryptDek(record.encryptedDek, record.dekIv, record.dekAuthTag);

    // 2. Encrypt DEK using NEW KEK
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', newKek, iv);
    
    let newEncryptedDek = cipher.update(dek.toString('hex'), 'utf8', 'hex');
    newEncryptedDek += cipher.final('hex');
    const newDekAuthTag = cipher.getAuthTag().toString('hex');

    // 3. Update DB
    await prisma.medicalRecord.update({
      where: { id: record.id },
      data: {
        encryptedDek: newEncryptedDek,
        dekIv: iv.toString('hex'),
        dekAuthTag: newDekAuthTag
      }
    });
  }

  console.log('Key rotation completed successfully for MedicalRecords');
}

if (require.main === module) {
  rotateKek().catch(console.error).finally(() => prisma.$disconnect());
}
