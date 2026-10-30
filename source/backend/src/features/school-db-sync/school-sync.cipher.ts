import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { AppException } from '../../shared/exception/app.exception.js';
import { SCHOOL_SYNC_ERRORS } from './school-sync.errors.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const KEY_ID_HEX_CHARS = 16;

export interface PasswordEnvelope {
  passwordCiphertext: Uint8Array<ArrayBuffer>;
  passwordIv: Uint8Array<ArrayBuffer>;
  passwordTag: Uint8Array<ArrayBuffer>;
  passwordKeyId: string;
}

// The connection password is write-only: it is stored sealed and only the connector opens it.
export class SchoolSyncCipher {
  private readonly key: Buffer | null;

  constructor(encodedKey: string | undefined) {
    const key = encodedKey ? Buffer.from(encodedKey, 'base64') : null;
    this.key = key?.length === KEY_BYTES ? key : null;
  }

  get available(): boolean {
    return this.key !== null;
  }

  private requireKey(): Buffer {
    if (!this.key) throw new AppException(SCHOOL_SYNC_ERRORS.KEY_UNAVAILABLE);
    return this.key;
  }

  keyId(): string {
    return createHash('sha256')
      .update(this.requireKey())
      .digest('hex')
      .slice(0, KEY_ID_HEX_CHARS);
  }

  seal(password: string): PasswordEnvelope {
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(password, 'utf8'),
      cipher.final(),
    ]);
    return {
      passwordCiphertext: new Uint8Array(ciphertext),
      passwordIv: new Uint8Array(iv),
      passwordTag: new Uint8Array(cipher.getAuthTag()),
      passwordKeyId: this.keyId(),
    };
  }

  // Null when the envelope was sealed with another key: the operator must enter the password again.
  open(envelope: PasswordEnvelope): string | null {
    if (!this.key || envelope.passwordKeyId !== this.keyId()) return null;
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, envelope.passwordIv);
      decipher.setAuthTag(envelope.passwordTag);
      return Buffer.concat([
        decipher.update(envelope.passwordCiphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
}
