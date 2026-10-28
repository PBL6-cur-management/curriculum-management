import { Injectable } from '@nestjs/common';
import { PasswordService } from '../password/password.service.js';
import { generateTemporaryPassword } from '../password/temporary-password.js';
import { normalizeStudentCode } from './student-identity.js';
import { STUDENT_LIMITS } from './student.constants.js';

export interface PreparedStudentAccount {
  studentCode: string;
  username: string;
  passwordHash: string;
  temporaryPassword: string;
}

// Hashes outside any database transaction: Argon2 is slow, and holding row locks while it runs would stall other writers.
@Injectable()
export class StudentAccountProvisioner {
  constructor(private readonly passwords: PasswordService) {}

  async prepare(
    studentCodes: readonly string[],
  ): Promise<PreparedStudentAccount[]> {
    const codes = [...new Set(studentCodes.map(normalizeStudentCode))];
    const prepared: PreparedStudentAccount[] = new Array(codes.length);
    let next = 0;
    const worker = async () => {
      while (next < codes.length) {
        const index = next++;
        const code = codes[index]!;
        const temporaryPassword = generateTemporaryPassword();
        prepared[index] = {
          studentCode: code,
          username: code.toLowerCase(),
          passwordHash: await this.passwords.hash(temporaryPassword),
          temporaryPassword,
        };
      }
    };
    await Promise.all(
      Array.from(
        {
          length: Math.min(
            STUDENT_LIMITS.PASSWORD_HASH_CONCURRENCY,
            codes.length,
          ),
        },
        worker,
      ),
    );
    return prepared;
  }
}
