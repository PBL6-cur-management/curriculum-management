import { PasswordService } from '../password/password.service.js';
import { StudentAccountProvisioner } from './student-account.provisioner.js';
import { STUDENT_LIMITS } from './student.constants.js';

describe('StudentAccountProvisioner', () => {
  it('prepares one verifiable account per distinct code with a lower-case username', async () => {
    const passwords = new PasswordService();
    const provisioner = new StudentAccountProvisioner(passwords);
    const prepared = await provisioner.prepare([
      ' syn-stu-0001 ',
      'SYN-STU-0001',
      'SYN-STU-0002',
    ]);
    expect(prepared.map((item) => item.studentCode)).toEqual([
      'SYN-STU-0001',
      'SYN-STU-0002',
    ]);
    expect(prepared[0]!.username).toBe('syn-stu-0001');
    expect(prepared[0]!.passwordHash).not.toContain(
      prepared[0]!.temporaryPassword,
    );
    for (const item of prepared) {
      expect(
        await passwords.verify(item.passwordHash, item.temporaryPassword),
      ).toBe(true);
    }
    expect(prepared[0]!.temporaryPassword).not.toBe(
      prepared[1]!.temporaryPassword,
    );
  });

  it('never hashes more passwords at once than the bound', async () => {
    let running = 0;
    let peak = 0;
    const passwords = {
      hash: vi.fn(async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 5));
        running -= 1;
        return 'hash';
      }),
    };
    const codes = Array.from({ length: 12 }, (_, index) => `SYN-STU-${index}0`);
    const prepared = await new StudentAccountProvisioner(
      passwords as never,
    ).prepare(codes);
    expect(prepared).toHaveLength(12);
    expect(peak).toBeLessThanOrEqual(STUDENT_LIMITS.PASSWORD_HASH_CONCURRENCY);
  });

  it('returns nothing for no codes', async () => {
    const passwords = { hash: vi.fn() };
    expect(
      await new StudentAccountProvisioner(passwords as never).prepare([]),
    ).toEqual([]);
    expect(passwords.hash).not.toHaveBeenCalled();
  });
});
