// Public demo only: fills the gaps the school's data cannot fill, so the demo account can submit and walk a request.
//   DATABASE_URL=... pnpm db:demo-fixtures        (run pnpm db:demo-account first)
// The school database has no program directors, no subject-group coordinators and no syllabus content
// (docs/reference/dut-school-db-discovery.md §5.3, §5.6). This script:
//   - makes the demo account director of every active program that has none,
//   - makes it coordinator of every subject group that has none,
//   - gives every course without any syllabus a Draft revision marked as a demo placeholder.
// Idempotent; it never touches a program, group or course that already has a real holder or syllabus.
// Never run it against a database real users depend on.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  CourseStatus,
  PrismaClient,
  ProgramStatus,
  SubjectGroupMemberRole,
  SyllabusStatus,
} from '../src/generated/prisma/client.js';
import { normalizeUsername } from '../src/shared/auth/username.js';
import { todayDate } from '../src/shared/time/today.js';

const username = normalizeUsername(process.env.DEMO_USERNAME ?? 'demo');
const PLACEHOLDER =
  '<p><em>Đề cương mẫu cho bản demo.</em> Nội dung chính thức của học phần chưa được nhập vào hệ thống.</p>';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const demo = await prisma.user.findUniqueOrThrow({ where: { username } });
  const today = todayDate();
  const active = {
    revokedAt: null,
    validFrom: { lte: today },
    OR: [{ validTo: null }, { validTo: { gte: today } }],
  };

  const programs = await prisma.program.findMany({
    where: {
      status: ProgramStatus.ACTIVE,
      directors: { none: active },
    },
    select: { id: true },
  });
  await prisma.programDirectorAssignment.createMany({
    data: programs.map((program) => ({
      programId: program.id,
      directorId: demo.id,
      validFrom: today,
      assignedById: demo.id,
    })),
  });

  const groups = await prisma.subjectGroup.findMany({
    where: {
      members: {
        none: { ...active, memberRole: SubjectGroupMemberRole.COORDINATOR },
      },
    },
    select: { id: true },
  });
  await prisma.subjectGroupMember.createMany({
    data: groups.map((group) => ({
      subjectGroupId: group.id,
      lecturerId: demo.id,
      memberRole: SubjectGroupMemberRole.COORDINATOR,
      validFrom: today,
      assignedById: demo.id,
    })),
  });

  const courses = await prisma.course.findMany({
    where: {
      status: { not: CourseStatus.CANCELLED },
      syllabi: { none: { sourceRequestId: null } },
    },
    select: { id: true },
  });
  await prisma.syllabus.createMany({
    data: courses.map((course) => ({
      courseId: course.id,
      revisionNumber: 1,
      status: SyllabusStatus.DRAFT,
      courseDescription: PLACEHOLDER,
    })),
  });

  console.log(
    `Demo: ${programs.length} chương trình nhận Giám đốc CTĐT, ${groups.length} nhóm nhận Điều phối, ` +
      `${courses.length} học phần nhận đề cương nháp mẫu.`,
  );
} finally {
  await prisma.$disconnect();
}
