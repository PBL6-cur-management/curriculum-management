import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { AppException } from '../exception/app.exception.js';
import { STUDENT_ERRORS } from './student.errors.js';

export const STUDENT_CREDENTIALS = {
  ALGORITHM: 'aes-256-gcm',
  KEY_BYTES: 32,
  IV_BYTES: 12,
  TAG_BYTES: 16,
  TTL_MS: 24 * 60 * 60 * 1000,
  KEY_ID_HEX_CHARS: 16,
} as const;

export interface EncryptedStudentCredentials {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  authTag: Uint8Array;
  keyId: string;
}

// Decoded configuration key; absent or malformed means the feature is unavailable, never a silent skip. The value is not echoed.
export function credentialKeyFrom(encoded: string | undefined): Uint8Array {
  const key = encoded ? Buffer.from(encoded, 'base64') : null;
  if (!key || key.length !== STUDENT_CREDENTIALS.KEY_BYTES) {
    throw new AppException(STUDENT_ERRORS.STUDENT_CREDENTIALS_UNAVAILABLE);
  }
  return new Uint8Array(key);
}

// Non-secret fingerprint stored beside the ciphertext so a rotated key is recognisable.
export function credentialKeyId(key: Uint8Array): string {
  return createHash('sha256')
    .update(key)
    .digest('hex')
    .slice(0, STUDENT_CREDENTIALS.KEY_ID_HEX_CHARS);
}

const aad = (batchId: string, ownerId: string) =>
  Buffer.from(`${batchId}:${ownerId}`, 'utf8');

export function encryptStudentCredentials(
  plaintext: Uint8Array,
  key: Uint8Array,
  batchId: string,
  ownerId: string,
): EncryptedStudentCredentials {
  const iv = randomBytes(STUDENT_CREDENTIALS.IV_BYTES);
  const cipher = createCipheriv(STUDENT_CREDENTIALS.ALGORITHM, key, iv, {
    authTagLength: STUDENT_CREDENTIALS.TAG_BYTES,
  });
  cipher.setAAD(aad(batchId, ownerId));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: new Uint8Array(ciphertext),
    iv: new Uint8Array(iv),
    authTag: new Uint8Array(cipher.getAuthTag()),
    keyId: credentialKeyId(key),
  };
}

// Throws the crypto library's error on a wrong key, wrong AAD or tampered bytes.
export function decryptStudentCredentials(
  value: EncryptedStudentCredentials,
  key: Uint8Array,
  batchId: string,
  ownerId: string,
): Uint8Array {
  const decipher = createDecipheriv(
    STUDENT_CREDENTIALS.ALGORITHM,
    key,
    value.iv,
    {
      authTagLength: STUDENT_CREDENTIALS.TAG_BYTES,
    },
  );
  decipher.setAAD(aad(batchId, ownerId));
  decipher.setAuthTag(value.authTag);
  return new Uint8Array(
    Buffer.concat([decipher.update(value.ciphertext), decipher.final()]),
  );
}
