import { describe, expect, it } from 'vitest';
import { parseComingSoon, parseDemoLogin } from './demoFlags';

describe('demoFlags', () => {
  it('reads "user:password" and rejects anything else', () => {
    expect(parseDemoLogin('demo:demo')).toEqual({
      username: 'demo',
      password: 'demo',
    });
    expect(parseDemoLogin('demo:a:b')).toEqual({
      username: 'demo',
      password: 'a:b',
    });
    for (const raw of [undefined, '', 'demo', ':demo', 'demo:']) {
      expect(parseDemoLogin(raw)).toBeNull();
    }
  });
  it('keeps only known coming-soon keys', () => {
    expect([...parseComingSoon(' backups, nope ,school-sync')]).toEqual([
      'backups',
      'school-sync',
    ]);
    expect(parseComingSoon(undefined).size).toBe(0);
  });
});
