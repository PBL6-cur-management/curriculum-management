import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { APPROVAL_LEVEL } from '../../src/shared/change-requests/approval.constants.js';
import { ROLE_CODES, type RoleCode } from './roles.js';

// Level 1 = subject-group coordinator (R4), level 2 = program director (R3), level 3 = faculty leadership (R2), level 4 = academic office (R1).
export const SEED_APPROVAL_LEVELS: readonly {
  approvalLevel: number;
  levelName: string;
  roleCode: RoleCode;
}[] = [
  {
    approvalLevel: APPROVAL_LEVEL.COORDINATOR,
    levelName: 'Điều phối nhóm chuyên môn',
    roleCode: ROLE_CODES.R4,
  },
  {
    approvalLevel: APPROVAL_LEVEL.DIRECTOR,
    levelName: 'Giám đốc CTĐT',
    roleCode: ROLE_CODES.R3,
  },
  {
    approvalLevel: APPROVAL_LEVEL.FACULTY_LEADERSHIP,
    levelName: 'Ban lãnh đạo khoa',
    roleCode: ROLE_CODES.R2,
  },
  {
    approvalLevel: APPROVAL_LEVEL.ACADEMIC_OFFICE,
    levelName: 'Phòng Đào tạo',
    roleCode: ROLE_CODES.R1,
  },
];

// After seedAccessControl: the levels point at seeded roles.
export async function seedApprovalLevels(prisma: PrismaClient): Promise<void> {
  for (const level of SEED_APPROVAL_LEVELS) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { roleCode: level.roleCode },
    });
    await prisma.approvalLevelConfig.upsert({
      where: { approvalLevel: level.approvalLevel },
      create: {
        approvalLevel: level.approvalLevel,
        levelName: level.levelName,
        roleId: role.id,
      },
      update: { levelName: level.levelName, roleId: role.id },
    });
  }
}
