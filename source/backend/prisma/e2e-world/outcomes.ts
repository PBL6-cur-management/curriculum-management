import type { PrismaClient } from '../../src/generated/prisma/client.js';

export const DEMO_PLOS: readonly {
  ploCode: string;
  description: string;
  englishDescription: string;
  competencyGroup: string;
}[] = [
  {
    ploCode: 'PLO1',
    description:
      'Vận dụng kiến thức toán học và khoa học cơ bản vào giải quyết các bài toán kỹ thuật.',
    englishDescription:
      'Apply mathematics and basic sciences to engineering problems.',
    competencyGroup: 'Kiến thức',
  },
  {
    ploCode: 'PLO2',
    description:
      'Hiểu và vận dụng kiến thức nền tảng của ngành: lập trình, cấu trúc dữ liệu, cơ sở dữ liệu, mạng và hệ điều hành.',
    englishDescription: 'Understand and apply core computing knowledge.',
    competencyGroup: 'Kiến thức',
  },
  {
    ploCode: 'PLO3',
    description:
      'Phân tích yêu cầu, thiết kế hệ thống và đánh giá giải pháp phần mềm.',
    englishDescription:
      'Analyze requirements, design systems and evaluate software solutions.',
    competencyGroup: 'Kỹ năng',
  },
  {
    ploCode: 'PLO4',
    description:
      'Lập trình, cài đặt và kiểm thử hệ thống bằng các ngôn ngữ và công cụ hiện đại.',
    englishDescription:
      'Implement and test systems with modern languages and tools.',
    competencyGroup: 'Kỹ năng',
  },
  {
    ploCode: 'PLO5',
    description:
      'Làm việc nhóm, giao tiếp và trình bày kết quả kỹ thuật hiệu quả.',
    englishDescription:
      'Work in teams, communicate and present technical results.',
    competencyGroup: 'Thái độ',
  },
  {
    ploCode: 'PLO6',
    description: 'Tuân thủ đạo đức nghề nghiệp và có năng lực tự học suốt đời.',
    englishDescription:
      'Observe professional ethics and learn independently throughout life.',
    competencyGroup: 'Thái độ',
  },
];

// Course x PLO weights, in (0, 1] with two decimals. Every PLO is covered by at least two courses.
export const DEMO_COURSE_PLO: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  MAT101: { PLO1: '1.00' },
  ITS100: { PLO6: '0.50' },
  PRG101: { PLO2: '0.50', PLO4: '1.00' },
  DMA101: { PLO1: '0.50', PLO2: '0.50' },
  OOP201: { PLO3: '0.50', PLO4: '1.00' },
  DSA201: { PLO2: '1.00', PLO4: '0.50' },
  DBS201: { PLO2: '0.50', PLO3: '1.00' },
  DBS202: { PLO4: '0.50', PLO5: '0.50' },
  NET201: { PLO2: '1.00' },
  OSY201: { PLO2: '0.50', PLO4: '0.50' },
  SWE301: { PLO3: '1.00', PLO5: '1.00' },
  AIT301: { PLO3: '0.50', PLO4: '0.50' },
  NET301: { PLO6: '1.00' },
  WEB301: { PLO4: '1.00', PLO5: '0.50' },
  DBS301: { PLO3: '0.50' },
  SWE302: { PLO3: '0.50', PLO6: '0.50' },
};

export async function seedDemoOutcomes(
  prisma: PrismaClient,
  versionId: string,
): Promise<void> {
  const ploIds = new Map<string, string>();
  for (const [index, plo] of DEMO_PLOS.entries()) {
    const row = await prisma.pLO.upsert({
      where: { versionId_ploCode: { versionId, ploCode: plo.ploCode } },
      create: { versionId, sortOrder: index + 1, ...plo },
      update: {},
    });
    ploIds.set(plo.ploCode, row.id);
  }
  const items = await prisma.curriculumItem.findMany({
    where: { versionId },
    select: { id: true, course: { select: { courseCode: true } } },
  });
  for (const item of items) {
    const cells = DEMO_COURSE_PLO[item.course.courseCode] ?? {};
    for (const [ploCode, weight] of Object.entries(cells)) {
      await prisma.coursePLOMapping.upsert({
        where: {
          curriculumItemId_ploId: {
            curriculumItemId: item.id,
            ploId: ploIds.get(ploCode)!,
          },
        },
        create: {
          curriculumItemId: item.id,
          ploId: ploIds.get(ploCode)!,
          weight,
        },
        update: {},
      });
    }
  }
}
