import {
  credentialKeyFrom,
  credentialKeyId,
  decryptStudentCredentials,
  encryptStudentCredentials,
} from './student-credential-cipher.js';

const key = new Uint8Array(Buffer.alloc(32, 5));
const otherKey = new Uint8Array(Buffer.alloc(32, 6));
const plain = new Uint8Array(Buffer.from('mật khẩu giả lập', 'utf8'));

describe('student credential cipher', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const first = encryptStudentCredentials(plain, key, 'batch', 'owner');
    const second = encryptStudentCredentials(plain, key, 'batch', 'owner');
    expect(Buffer.from(first.iv).equals(Buffer.from(second.iv))).toBe(false);
    expect(Buffer.from(first.ciphertext).equals(Buffer.from(plain))).toBe(
      false,
    );
    expect(
      Buffer.from(decryptStudentCredentials(first, key, 'batch', 'owner')),
    ).toEqual(Buffer.from(plain));
    expect(first.keyId).toBe(credentialKeyId(key));
    expect(first.keyId).not.toBe(credentialKeyId(otherKey));
  });

  it('rejects a wrong key, wrong batch or owner, and tampered bytes', () => {
    const sealed = encryptStudentCredentials(plain, key, 'batch', 'owner');
    expect(() =>
      decryptStudentCredentials(sealed, otherKey, 'batch', 'owner'),
    ).toThrow();
    expect(() =>
      decryptStudentCredentials(sealed, key, 'other', 'owner'),
    ).toThrow();
    expect(() =>
      decryptStudentCredentials(sealed, key, 'batch', 'other'),
    ).toThrow();
    const flipped = new Uint8Array(sealed.ciphertext);
    flipped[0] ^= 1;
    expect(() =>
      decryptStudentCredentials(
        { ...sealed, ciphertext: flipped },
        key,
        'batch',
        'owner',
      ),
    ).toThrow();
    const tag = new Uint8Array(sealed.authTag);
    tag[0] ^= 1;
    expect(() =>
      decryptStudentCredentials(
        { ...sealed, authTag: tag },
        key,
        'batch',
        'owner',
      ),
    ).toThrow();
  });

  it('decodes a 32-byte base64 key and otherwise reports the feature unavailable', () => {
    expect(credentialKeyFrom(Buffer.alloc(32, 5).toString('base64'))).toEqual(
      key,
    );
    for (const bad of [
      undefined,
      '',
      Buffer.alloc(16).toString('base64'),
      'not base64!',
    ]) {
      expect(() => credentialKeyFrom(bad)).toThrow(
        expect.objectContaining({ code: 'STUDENT_CREDENTIALS_UNAVAILABLE' }),
      );
    }
  });
});
