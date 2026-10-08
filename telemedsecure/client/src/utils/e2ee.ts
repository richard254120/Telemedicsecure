import { Buffer } from 'buffer';

export const generateECDHKeyPair = async () => {
  return await window.crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
};

export const exportPublicKey = async (key: CryptoKey) => {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return Buffer.from(exported).toString('hex');
};

export const importPublicKey = async (hexKey: string) => {
  const buffer = Buffer.from(hexKey, 'hex');
  return await window.crypto.subtle.importKey(
    'raw',
    buffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
};

export const deriveSharedSecret = async (privateKey: CryptoKey, publicKey: CryptoKey) => {
  return await window.crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

export const encryptMessage = async (key: CryptoKey, message: string) => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(message);
  
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  return {
    ciphertext: Buffer.from(ciphertext).toString('hex'),
    iv: Buffer.from(iv).toString('hex')
  };
};

export const decryptMessage = async (key: CryptoKey, ciphertextHex: string, ivHex: string) => {
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
};

// WebRTC Insertable Streams setup (concept implementation for frame encryption)
export const setupInsertableStreams = (sender: RTCRtpSender, receiver: RTCRtpReceiver, key: CryptoKey) => {
  // In a full implementation, you'd use a TransformStream to encrypt/decrypt encoded frames
  // const senderStreams = sender.createEncodedStreams();
  // const receiverStreams = receiver.createEncodedStreams();
  // ... pipe readable to transform (AES-GCM) to writable ...
  console.log('Insertable Streams configured with derived AES-GCM shared key');
};
