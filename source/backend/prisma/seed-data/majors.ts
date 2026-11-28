import { MajorStatus, type PrismaClient } from '../../src/generated/prisma/client.js';
import { HOME_FACULTY_CODE } from '../../src/shared/org-units/home-faculty.js';

export interface SeedMajorRow {
  majorCode: string;
  majorName: string;
  degreeGroup: 'CD01' | 'CD02' | 'CD03';
  facultyCode?: string;
}

// Public MOET national major catalog taught at DUT (ĐH Bách khoa Đà Nẵng):
// 7xxxxxx = Đại học (CD01), 8xxxxxx = Thạc sĩ (CD02), 9xxxxxx = Tiến sĩ (CD03).
export const SEED_MAJORS: readonly SeedMajorRow[] = [
  // Đại học (CD01)
  { majorCode: '7140214', majorName: 'Sư phạm kỹ thuật công nghiệp', degreeGroup: 'CD01' },
  { majorCode: '7420201', majorName: 'Công nghệ Sinh học', degreeGroup: 'CD01' },
  { majorCode: '7480201', majorName: 'Công nghệ Thông tin', degreeGroup: 'CD01', facultyCode: HOME_FACULTY_CODE },
  { majorCode: '7510105', majorName: 'Công nghệ Kỹ thuật Vật liệu xây dựng', degreeGroup: 'CD01' },
  { majorCode: '7510202', majorName: 'Công nghệ Chế tạo máy', degreeGroup: 'CD01' },
  { majorCode: '7510601', majorName: 'Quản lý Công nghiệp', degreeGroup: 'CD01' },
  { majorCode: '7510701', majorName: 'Công nghệ Dầu khí và Khai thác dầu', degreeGroup: 'CD01' },
  { majorCode: '7520103', majorName: 'Kỹ thuật Cơ khí động lực', degreeGroup: 'CD01' },
  { majorCode: '7520114', majorName: 'Kỹ thuật Cơ điện tử', degreeGroup: 'CD01' },
  { majorCode: '7520115', majorName: 'Kỹ thuật Nhiệt', degreeGroup: 'CD01' },
  { majorCode: '7520118', majorName: 'Kỹ thuật Hệ thống công nghiệp', degreeGroup: 'CD01' },
  { majorCode: '7520122', majorName: 'Kỹ thuật Tàu thủy', degreeGroup: 'CD01' },
  { majorCode: '7520201', majorName: 'Kỹ thuật Điện', degreeGroup: 'CD01' },
  { majorCode: '7520207', majorName: 'Kỹ thuật Điện tử Viễn thông', degreeGroup: 'CD01' },
  { majorCode: '7520216', majorName: 'Kỹ thuật Điều khiển và Tự động hóa', degreeGroup: 'CD01' },
  { majorCode: '7520301', majorName: 'Kỹ thuật Hóa học', degreeGroup: 'CD01' },
  { majorCode: '7520320', majorName: 'Kỹ thuật Môi trường', degreeGroup: 'CD01' },
  { majorCode: '7540101', majorName: 'Công nghệ Thực phẩm', degreeGroup: 'CD01' },
  { majorCode: '7580101', majorName: 'Kiến trúc', degreeGroup: 'CD01' },
  { majorCode: '7580201', majorName: 'Kỹ thuật Xây dựng', degreeGroup: 'CD01' },
  { majorCode: '7580202', majorName: 'Kỹ thuật Xây dựng Công trình thủy', degreeGroup: 'CD01' },
  { majorCode: '7580205', majorName: 'Kỹ thuật Xây dựng Công trình giao thông', degreeGroup: 'CD01' },
  { majorCode: '7580210', majorName: 'Kỹ thuật Cơ sở hạ tầng', degreeGroup: 'CD01' },
  { majorCode: '7580301', majorName: 'Kinh tế Xây dựng', degreeGroup: 'CD01' },
  { majorCode: '7850101', majorName: 'Quản lý Tài nguyên và Môi trường', degreeGroup: 'CD01' },
  // Thạc sĩ (CD02)
  { majorCode: '8420201', majorName: 'Công nghệ sinh học', degreeGroup: 'CD02' },
  { majorCode: '8480101', majorName: 'Khoa học máy tính', degreeGroup: 'CD02', facultyCode: HOME_FACULTY_CODE },
  { majorCode: '8520103', majorName: 'Kỹ thuật cơ khí', degreeGroup: 'CD02' },
  { majorCode: '8520114', majorName: 'Kỹ thuật cơ điện tử', degreeGroup: 'CD02' },
  { majorCode: '8520115', majorName: 'Kỹ thuật nhiệt', degreeGroup: 'CD02' },
  { majorCode: '8520116', majorName: 'Kỹ thuật cơ khí động lực', degreeGroup: 'CD02' },
  { majorCode: '8520201', majorName: 'Kỹ thuật điện', degreeGroup: 'CD02' },
  { majorCode: '8520203', majorName: 'Kỹ thuật điện tử', degreeGroup: 'CD02' },
  { majorCode: '8520216', majorName: 'Kỹ thuật điều khiển và tự động hóa', degreeGroup: 'CD02' },
  { majorCode: '8520301', majorName: 'Kỹ thuật hóa học', degreeGroup: 'CD02' },
  { majorCode: '8520320', majorName: 'Kỹ thuật môi trường', degreeGroup: 'CD02' },
  { majorCode: '8540101', majorName: 'Công nghệ thực phẩm', degreeGroup: 'CD02' },
  { majorCode: '8580101', majorName: 'Kiến trúc', degreeGroup: 'CD02' },
  { majorCode: '8580202', majorName: 'Kỹ thuật xây dựng công trình thủy', degreeGroup: 'CD02' },
  { majorCode: '8580205', majorName: 'Kỹ thuật xây dựng công trình giao thông', degreeGroup: 'CD02' },
  { majorCode: '8580208', majorName: 'Kỹ thuật xây dựng dân dụng và công nghiệp', degreeGroup: 'CD02' },
  { majorCode: '8580302', majorName: 'Quản lý Xây dựng', degreeGroup: 'CD02' },
  // Tiến sĩ (CD03)
  { majorCode: '9420201', majorName: 'Công nghệ sinh học', degreeGroup: 'CD03' },
  { majorCode: '9480101', majorName: 'Khoa học máy tính', degreeGroup: 'CD03', facultyCode: HOME_FACULTY_CODE },
  { majorCode: '9520101', majorName: 'Cơ kỹ thuật', degreeGroup: 'CD03' },
  { majorCode: '9520103', majorName: 'Kỹ thuật cơ khí', degreeGroup: 'CD03' },
  { majorCode: '9520115', majorName: 'Kỹ thuật nhiệt', degreeGroup: 'CD03' },
  { majorCode: '9520116', majorName: 'Kỹ thuật cơ khí động lực', degreeGroup: 'CD03' },
  { majorCode: '9520201', majorName: 'Kỹ thuật điện', degreeGroup: 'CD03' },
  { majorCode: '9520203', majorName: 'Kỹ thuật điện tử', degreeGroup: 'CD03' },
  { majorCode: '9520208', majorName: 'Kỹ thuật viễn thông', degreeGroup: 'CD03' },
  { majorCode: '9520216', majorName: 'Kỹ thuật điều khiển và tự động hóa', degreeGroup: 'CD03' },
  { majorCode: '9520320', majorName: 'Kỹ thuật môi trường', degreeGroup: 'CD03' },
  { majorCode: '9540101', majorName: 'Công nghệ thực phẩm', degreeGroup: 'CD03' },
  { majorCode: '9580202', majorName: 'Kỹ thuật xây dựng công trình thủy', degreeGroup: 'CD03' },
  { majorCode: '9580205', majorName: 'Kỹ thuật xây dựng công trình giao thông', degreeGroup: 'CD03' },
] as const;

export async function seedMajors(prisma: PrismaClient): Promise<void> {
  const units = await prisma.orgUnit.findMany({
    select: { id: true, unitCode: true },
  });
  const unitByCode = new Map(units.map((u) => [u.unitCode, u.id]));
  for (const major of SEED_MAJORS) {
    const facultyId = major.facultyCode
      ? (unitByCode.get(major.facultyCode) ?? null)
      : null;
    await prisma.major.upsert({
      where: { majorCode: major.majorCode },
      create: {
        majorCode: major.majorCode,
        majorName: major.majorName,
        degreeGroup: major.degreeGroup,
        facultyId,
        status: MajorStatus.ACTIVE,
      },
      update: {
        majorName: major.majorName,
        degreeGroup: major.degreeGroup,
        ...(facultyId ? { facultyId } : {}),
      },
    });
  }

  // Link any existing programs missing majorId using exact or base national major code (e.g. 7480201A -> 7480201).
  const allMajors = await prisma.major.findMany({
    select: { id: true, majorCode: true },
  });
  const majorByCode = new Map(allMajors.map((m) => [m.majorCode, m.id]));
  const unlinked = await prisma.program.findMany({
    where: { majorId: null },
    select: {
      id: true,
      versions: {
        where: { sourceRequestId: null },
        select: { majorCode: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  for (const program of unlinked) {
    const picked =
      program.versions.find((v) => v.status === 'ACTIVE') ??
      program.versions.find((v) => v.status === 'PENDING') ??
      program.versions[0];
    if (!picked) continue;
    const baseCode = picked.majorCode.replace(/[^0-9].*$/, '');
    const majorId =
      majorByCode.get(picked.majorCode) ?? majorByCode.get(baseCode);
    if (majorId) {
      await prisma.program.update({
        where: { id: program.id },
        data: { majorId },
      });
    }
  }
}
