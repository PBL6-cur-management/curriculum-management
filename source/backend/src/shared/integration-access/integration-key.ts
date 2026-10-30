import { createHash, randomBytes } from 'node:crypto';
import { INTEGRATION } from './integration.constants.js';

// The plaintext key exists only in the create response; storage keeps its SHA-256.
export function generateIntegrationKey(): { key: string; keyHash: string } {
  const key = `${INTEGRATION.KEY_PREFIX}${randomBytes(INTEGRATION.KEY_BYTES).toString('base64url')}`;
  return { key, keyHash: hashIntegrationKey(key) };
}

export function hashIntegrationKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}
