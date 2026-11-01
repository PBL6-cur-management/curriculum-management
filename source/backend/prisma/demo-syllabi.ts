// Public demo only: fills the placeholder syllabi from pnpm db:demo-fixtures with whatever the school's database
// holds, and with clearly marked sample text where it holds nothing.
//   DATABASE_URL=... DUT_MIRROR_ROOT=D:/dut-mirror pnpm db:demo-syllabi
// Real, from the local mirror (docs/reference/dut-school-db-discovery.md §5.6):
//   tmHocPhan.Mota → description, ChuanKT → objectives, TaiLieuTK → references, TenHP1 → English title,
//   LyThuyet/ThucHanh → teaching methods, MaCongThuc + congthucdiem → grade formula, tmHocPhanLT → weekly content.
// Sample (the school has none): CLOs, the assessment–CLO mapping, and any section above that is empty.
// Touches only Draft syllabi whose description is still the demo placeholder, so a second run changes nothing.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PUBLISHABLE_SYLLABUS_SELECT,
  syllabusPublishIssues,
} from '../src/shared/releases/syllabus-release-issues.js';
import {
  Prisma,
  PrismaClient,
  SyllabusStatus,
} from '../src/generated/prisma/client.js';
import { mirrorRoot } from './seed-data/dut/extract/mirror-tables.js';
import {
  readMirrorCsv as readCsv,
  type MirrorRow as Row,
} from './demo-mirror.js';

const PLACEHOLDER_MARK = 'Đề cương mẫu cho bản demo';
const SAMPLE_NOTE =
  '<p><em>Bản demo: phần in nghiêng ghi “mẫu” là nội dung minh họa, chưa phải đề cương chính thức của Khoa.</em></p>';

const filled = (value: string | undefined) =>
  value !== undefined && value !== '' && value !== 'NULL' ? value : null;

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Plain multi-line text from the school → paragraphs, or a list when it reads as one.
function toHtml(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-–•\t\s]+/, '').trim())
    .filter(Boolean);
  if (lines.length <= 1) return `<p>${escapeHtml(lines[0] ?? text)}</p>`;
  return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
}

const sample = (html: string) => `<p><em>(mẫu)</em></p>${html}`;

const COMPONENT_NAMES: Record<string, string> = {
  CK: 'Thi cuối kỳ',
  GK: 'Kiểm tra giữa kỳ',
  BT: 'Bài tập',
  TN: 'Thí nghiệm',
  QT: 'Quá trình',
  TH: 'Thực hành',
  CC: 'Chuyên cần',
  HD: 'Hoạt động trên lớp',
  VI: 'Vấn đáp',
  DA: 'Đồ án',
  DO: 'Đồ án',
  BC: 'Báo cáo',
  BV: 'Bảo vệ',
  VD: 'Vấn đáp',
  KT: 'Kiểm tra',
  TT: 'Thực tập',
  LN: 'Làm nhóm',
  LT: 'Lý thuyết',
  RD: 'Rèn luyện',
  DG: 'Đánh giá',
};

interface Component {
  code: string;
  name: string;
  weight: Prisma.Decimal;
}

// "[GK]*0.30+[CK]*0.70" → GK 30 %, CK 70 %; null unless the weights add up to exactly 100.
function parseFormula(expression: string | null): Component[] | null {
  if (!expression) return null;
  const terms = [...expression.matchAll(/\[(\w+)\]\s*\*\s*([0-9.]+)/g)];
  if (terms.length === 0) return null;
  const merged = new Map<string, Prisma.Decimal>();
  for (const [, code, factor] of terms) {
    const weight = new Prisma.Decimal(factor).times(100);
    merged.set(code, (merged.get(code) ?? new Prisma.Decimal(0)).plus(weight));
  }
  const components = [...merged].map(([code, weight]) => ({
    code,
    name: COMPONENT_NAMES[code] ?? `Thành phần ${code}`,
    weight: weight.toDecimalPlaces(2),
  }));
  const total = components.reduce(
    (sum, c) => sum.plus(c.weight),
    new Prisma.Decimal(0),
  );
  return total.eq(100) && components.every((c) => c.weight.gt(0))
    ? components
    : null;
}

const DEFAULT_FORMULA: Component[] = [
  { code: 'GK', name: COMPONENT_NAMES.GK, weight: new Prisma.Decimal(30) },
  { code: 'CK', name: COMPONENT_NAMES.CK, weight: new Prisma.Decimal(70) },
];

function sampleClos(courseName: string) {
  return [
    {
      cloCode: 'CLO1',
      description: `Trình bày được các khái niệm và nguyên lý cơ bản của học phần ${courseName}.`,
      cognitiveLevel: 'Hiểu',
    },
    {
      cloCode: 'CLO2',
      description: `Vận dụng được kiến thức của học phần ${courseName} để giải các bài tập và tình huống điển hình.`,
      cognitiveLevel: 'Vận dụng',
    },
    {
      cloCode: 'CLO3',
      description:
        'Phân tích và lựa chọn được giải pháp phù hợp cho một bài toán thực tế của ngành.',
      cognitiveLevel: 'Phân tích',
    },
  ];
}

function sampleWeeks(courseName: string) {
  return [
    ['1–3', `Giới thiệu học phần ${courseName}; các khái niệm nền tảng.`],
    ['4–7', 'Các nội dung cốt lõi; bài tập áp dụng trên lớp.'],
    ['8', 'Kiểm tra giữa kỳ.'],
    ['9–13', 'Nội dung nâng cao; bài tập lớn hoặc thực hành theo nhóm.'],
    ['14–15', 'Ôn tập, tổng kết và giải đáp.'],
  ] as const;
}

function teachingMethods(theory: number, practice: number): string {
  const parts = [
    theory > 0
      ? `Lý thuyết ${theory} tín chỉ: giảng trên lớp, thảo luận, bài tập`
      : null,
    practice > 0
      ? `Thực hành ${practice} tín chỉ: làm bài tại phòng máy/phòng thí nghiệm`
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length
    ? toHtml(parts.join('\n'))
    : sample('<p>Giảng trên lớp, thảo luận và bài tập.</p>');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

try {
  const root = mirrorRoot(
    process.argv.slice(2).find((arg) => !arg.startsWith('--')),
  );
  const [teacherCourses, proxCourses, formulas, weekly] = await Promise.all([
    readCsv(root, 'DATA_GVien1', 'tmHocPhan'),
    readCsv(root, 'tmProxDUT', 'tmHocPhan'),
    readCsv(root, 'DHBK_CDS', 'congthucdiem'),
    readCsv(root, 'DATA_GVien1', 'tmHocPhanLT'),
  ]);
  const byCode = (rows: Row[]) => new Map(rows.map((row) => [row.MaHP, row]));
  const teacher = byCode(teacherCourses);
  const prox = byCode(proxCourses);
  const formulaByCode = new Map(
    formulas.map((row) => [row.Macongthuc, row.VarString3]),
  );
  const weeksByCourse = new Map<string, Row[]>();
  for (const row of weekly) {
    if (!filled(row.NoiDung)) continue;
    const list = weeksByCourse.get(row.MaHP) ?? [];
    list.push(row);
    weeksByCourse.set(row.MaHP, list);
  }

  const syllabi = await prisma.syllabus.findMany({
    where: {
      status: SyllabusStatus.DRAFT,
      sourceRequestId: null,
      OR: [
        { courseDescription: { contains: PLACEHOLDER_MARK } },
        // A draft someone emptied in the UI before it was filled: no text, no CLO, no formula.
        {
          AND: [
            { OR: [{ courseDescription: null }, { courseDescription: '' }] },
            { clos: { none: {} } },
            { assessmentComponents: { none: {} } },
          ],
        },
      ],
    },
    select: {
      id: true,
      course: { select: { courseCode: true, courseName: true } },
    },
  });

  const counts = {
    syllabi: 0,
    realDescription: 0,
    realWeeks: 0,
    realFormula: 0,
    references: 0,
  };
  for (const syllabus of syllabi) {
    const { courseCode, courseName } = syllabus.course;
    const t = teacher.get(courseCode);
    const p = prox.get(courseCode);
    const pick = (column: string) => filled(t?.[column]) ?? filled(p?.[column]);

    const description = pick('Mota');
    const objectives = pick('ChuanKT');
    const references = pick('TaiLieuTK') ?? pick('GiaoTrinh');
    const english = pick('TenHP1');
    const theory = Number(pick('LyThuyet') ?? 0);
    const practice = Number(pick('ThucHanh') ?? 0);
    const realFormula = parseFormula(
      filled(formulaByCode.get(pick('MaCongThuc') ?? '')) ?? null,
    );
    const components = realFormula ?? DEFAULT_FORMULA;
    const realWeeks = (weeksByCourse.get(courseCode) ?? []).sort(
      (a, b) => Number(a.Tuan) - Number(b.Tuan) || Number(a.ID) - Number(b.ID),
    );
    const clos = sampleClos(courseName);

    await prisma.$transaction(async (tx) => {
      await tx.syllabus.update({
        where: { id: syllabus.id },
        data: {
          courseDescription:
            (description
              ? toHtml(description)
              : sample(
                  `<p>Học phần ${escapeHtml(courseName)} trang bị cho sinh viên kiến thức nền tảng và kỹ năng vận dụng trong lĩnh vực của học phần, làm cơ sở cho các học phần tiếp theo trong chương trình.</p>`,
                )) + SAMPLE_NOTE,
          englishDescription: english ? `<p>${escapeHtml(english)}</p>` : null,
          objectives: objectives
            ? toHtml(objectives)
            : sample(
                '<ul><li>Nắm vững kiến thức cốt lõi của học phần.</li><li>Rèn luyện kỹ năng giải quyết vấn đề và làm việc nhóm.</li><li>Hình thành thái độ học tập chủ động, trung thực.</li></ul>',
              ),
          teachingMethods: teachingMethods(theory, practice),
          assessmentMethods:
            (realFormula ? '' : '<p><em>(mẫu)</em></p>') +
            toHtml(
              components
                .map((c) => `${c.name} (${c.code}): ${c.weight.toString()}%`)
                .join('\n'),
            ),
          references: references ? toHtml(references) : null,
        },
      });

      const createdClos = [];
      for (const [index, clo] of clos.entries()) {
        createdClos.push(
          await tx.cLO.create({
            data: { syllabusId: syllabus.id, sortOrder: index + 1, ...clo },
            select: { id: true },
          }),
        );
      }

      const weeks = realWeeks.length
        ? realWeeks.map((row) => ({
            weekLabel: row.Tuan,
            content: toHtml(row.NoiDung),
            teachingActivities:
              [
                Number(row.LT) > 0 ? `${row.LT} tiết lý thuyết` : null,
                Number(row.BT) > 0 ? `${row.BT} tiết bài tập` : null,
                Number(row.TH) > 0 ? `${row.TH} tiết thực hành` : null,
              ]
                .filter(Boolean)
                .join(', ') || null,
          }))
        : sampleWeeks(courseName).map(([weekLabel, content]) => ({
            weekLabel,
            content: sample(`<p>${escapeHtml(content)}</p>`),
            teachingActivities: null,
          }));
      for (const [index, week] of weeks.entries()) {
        const row = await tx.weeklyContent.create({
          data: { syllabusId: syllabus.id, sortOrder: index + 1, ...week },
          select: { id: true },
        });
        // Spread the CLOs over the semester: early weeks CLO1, middle CLO2, late CLO3.
        const clo =
          createdClos[Math.min(2, Math.floor((index * 3) / weeks.length))];
        await tx.weeklyContentCLO.create({
          data: { weeklyContentId: row.id, cloId: clo.id },
        });
      }

      // The heaviest component (normally the final exam) assesses every CLO; the others assess CLO2 and CLO3.
      const heaviest = components.reduce((a, b) =>
        b.weight.gt(a.weight) ? b : a,
      );
      for (const component of components) {
        const created = await tx.assessmentComponent.create({
          data: {
            syllabusId: syllabus.id,
            componentCode: component.code,
            componentName: component.name,
            weight: component.weight,
          },
          select: { id: true },
        });
        const assessed =
          component === heaviest ? createdClos : createdClos.slice(1);
        await tx.assessmentCLOMapping.createMany({
          data: assessed.map((clo) => ({
            assessmentComponentId: created.id,
            cloId: clo.id,
          })),
        });
      }
    });

    counts.syllabi += 1;
    if (description) counts.realDescription += 1;
    if (realWeeks.length) counts.realWeeks += 1;
    if (realFormula) counts.realFormula += 1;
    if (references) counts.references += 1;
  }

  console.log(
    `Đã điền ${counts.syllabi} đề cương: mô tả thật ${counts.realDescription}, nội dung tuần thật ${counts.realWeeks}, ` +
      `công thức điểm thật ${counts.realFormula}, tài liệu tham khảo ${counts.references}; phần còn lại là mẫu.`,
  );
  // --publish: a course taught in a released program has a published syllabus, so change requests can target it.
  // Publishes each ordinary draft that passes the release rule, for courses with no published revision yet.
  if (process.argv.includes('--publish')) {
    const drafts = await prisma.syllabus.findMany({
      where: {
        status: SyllabusStatus.DRAFT,
        sourceRequestId: null,
        course: { syllabi: { none: { status: SyllabusStatus.PUBLISHED } } },
      },
      select: PUBLISHABLE_SYLLABUS_SELECT,
    });
    let published = 0;
    const blocked: string[] = [];
    for (const draft of drafts) {
      const issues = syllabusPublishIssues(draft);
      if (issues.length) {
        blocked.push(`${draft.courseId}: ${issues.join(', ')}`);
        continue;
      }
      await prisma.syllabus.update({
        where: { id: draft.id },
        data: { status: SyllabusStatus.PUBLISHED, publishedAt: new Date() },
      });
      published += 1;
    }
    console.log(
      `Đã ban hành ${published} đề cương; ${blocked.length} chưa đủ điều kiện.`,
    );
    for (const line of blocked.slice(0, 20)) console.log(`  ${line}`);
  }
} finally {
  await prisma.$disconnect();
}
