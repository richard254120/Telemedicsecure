import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// In a real scenario, MASTER_KEY would be loaded from an HSM or KMS.
const getMasterKey = () => crypto.scryptSync(process.env.MASTER_KEY || process.env.JWT_SECRET || 'secret', 'salt', 32);

export const generateDek = () => crypto.randomBytes(32);

export const encryptDek = (dek: Buffer) => {
  const iv = crypto.randomBytes(16);
  const kek = getMasterKey();
  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv);
  
  let ciphertext = cipher.update(dek.toString('hex'), 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return { encryptedDek: ciphertext, dekIv: iv.toString('hex'), dekAuthTag: authTag };
};

export const decryptDek = (encryptedDek: string, dekIv: string, dekAuthTag: string): Buffer => {
  const kek = getMasterKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, kek, Buffer.from(dekIv, 'hex'));
  decipher.setAuthTag(Buffer.from(dekAuthTag, 'hex'));
  
  let dekHex = decipher.update(encryptedDek, 'hex', 'utf8');
  dekHex += decipher.final('utf8');
  return Buffer.from(dekHex, 'hex');
};

export const encryptDataEnvelope = (plaintext: string) => {
  const dek = generateDek();
  const { encryptedDek, dekIv, dekAuthTag } = encryptDek(dek);
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedDek,
    dekIv,
    dekAuthTag,
    ciphertext,
    iv: iv.toString('hex'),
    authTag
  };
};

export const decryptDataEnvelope = (ciphertext: string, iv: string, authTag: string, encryptedDek: string, dekIv: string, dekAuthTag: string) => {
  const dek = decryptDek(encryptedDek, dekIv, dekAuthTag);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, dek, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
};

// --- Ed25519 Digital Signatures for Prescriptions ---

/**
 * Deterministically serialize a JavaScript value to Canonical JSON (RFC 8785 style)
 * Keys are sorted lexicographically, no arbitrary whitespace.
 */
export const canonicalJson = (obj: any): string => {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',') + '}';
};

/**
 * Generate Ed25519 keypair for a doctor.
 * The private key is encrypted with an AES-256-GCM key derived from the doctor's password via PBKDF2.
 */
export const generateDoctorEd25519Keys = (password: string) => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  let encryptedPrivKey = cipher.update(privPem, 'utf8', 'hex');
  encryptedPrivKey += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    publicKey: pubPem,
    encryptedPrivateKey: encryptedPrivKey,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag
  };
};

/**
 * Decrypt the doctor's Ed25519 private key using their password.
 */
export const decryptDoctorPrivateKey = (
  encryptedPrivKeyHex: string,
  saltHex: string,
  ivHex: string,
  authTagHex: string,
  password: string
): crypto.KeyObject => {
  const salt = Buffer.from(saltHex, 'hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decryptedPem = decipher.update(encryptedPrivKeyHex, 'hex', 'utf8');
  decryptedPem += decipher.final('utf8');

  return crypto.createPrivateKey(decryptedPem);
};

/**
 * Sign canonical JSON of a prescription: compute SHA-256 hash, then sign with Ed25519 private key.
 */
export const signPrescriptionCanonical = (privateKey: crypto.KeyObject, canonicalData: string) => {
  const canonicalHash = crypto.createHash('sha256').update(canonicalData).digest();
  const signature = crypto.sign(null, canonicalHash, privateKey);
  return {
    signatureHex: signature.toString('hex'),
    canonicalHashHex: canonicalHash.toString('hex')
  };
};

/**
 * Verify Ed25519 signature over SHA-256 hash of canonical JSON data using doctor's public key PEM.
 */
export const verifyPrescriptionCanonical = (
  publicKeyPem: string,
  canonicalData: string,
  signatureHex: string
): { isValid: boolean; computedHash: string } => {
  const computedHash = crypto.createHash('sha256').update(canonicalData).digest();
  try {
    const pubKeyObj = crypto.createPublicKey(publicKeyPem);
    const isValid = crypto.verify(null, computedHash, pubKeyObj, Buffer.from(signatureHex, 'hex'));
    return { isValid, computedHash: computedHash.toString('hex') };
  } catch (err) {
    return { isValid: false, computedHash: computedHash.toString('hex') };
  }
};

// Backwards-compatibility helpers
export const generateEd25519KeyPair = () => crypto.generateKeyPairSync('ed25519');
export const signPrescription = (privateKey: crypto.KeyObject, data: string) => crypto.sign(null, Buffer.from(data), privateKey).toString('hex');
export const verifyPrescription = (publicKey: crypto.KeyObject, data: string, signature: string) => crypto.verify(null, Buffer.from(data), publicKey, Buffer.from(signature, 'hex'));

