import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { sanitizeRichText } from '../../src/shared/rich-text/sanitize-rich-text.js';
import { DEMO_COURSES } from './catalog.js';

interface DemoClo {
  cloCode: string;
  description: string;
  englishDescription: string;
  cognitiveLevel: string;
  plos: readonly string[];
}

interface DemoWeek {
  weekLabel: string;
  content: string;
  teachingActivities: string;
  clos: readonly string[];
}

interface DemoSyllabus {
  courseCode: string;
  courseDescription: string;
  englishDescription: string;
  objectives: string;
  teachingMethods: string;
  assessmentMethods: string;
  references: string;
  clos: readonly DemoClo[];
  weeks: readonly DemoWeek[];
}

const ASSESSMENT = `<table><tbody><tr><th>Thành phần</th><th>Hình thức</th><th>Tỷ trọng</th></tr><tr><td>Quá trình</td><td>Bài tập, thực hành, kiểm tra giữa kỳ</td><td>40%</td></tr><tr><td>Cuối kỳ</td><td>Thi viết hoặc vấn đáp</td><td>60%</td></tr></tbody></table>`;

// CLO -> PLO links may use only the PLOs the course has in the matrix (DEMO_COURSE_PLO).
export const DEMO_SYLLABI: readonly DemoSyllabus[] = [
  {
    courseCode: 'PRG101',
    courseDescription:
      '<p>Học phần giới thiệu tư duy lập trình, các cấu trúc điều khiển, hàm, mảng và con trỏ bằng ngôn ngữ C/C++.</p>',
    englishDescription:
      '<p>Introduces programming fundamentals in C/C++: control flow, functions, arrays and pointers.</p>',
    objectives:
      '<ul><li>Hình thành tư duy giải quyết bài toán bằng thuật toán.</li><li>Viết được chương trình C/C++ có cấu trúc rõ ràng.</li></ul>',
    teachingMethods:
      '<p>Giảng lý thuyết kết hợp thực hành tại phòng máy; bài tập lớn theo nhóm hai sinh viên.</p>',
    assessmentMethods: ASSESSMENT,
    references:
      '<ol><li>Kernighan B., Ritchie D., <em>The C Programming Language</em>, Prentice Hall.</li><li>Giáo trình Nhập môn lập trình, Khoa CNTT – ĐHBK Đà Nẵng.</li></ol>',
    clos: [
      {
        cloCode: 'CLO1',
        description:
          'Trình bày được các khái niệm cơ bản của lập trình và thuật toán.',
        englishDescription: 'Explain basic programming and algorithm concepts.',
        cognitiveLevel: 'Hiểu',
        plos: ['PLO2'],
      },
      {
        cloCode: 'CLO2',
        description:
          'Viết được chương trình dùng cấu trúc điều khiển, hàm và mảng.',
        englishDescription:
          'Write programs using control flow, functions and arrays.',
        cognitiveLevel: 'Vận dụng',
        plos: ['PLO4'],
      },
      {
        cloCode: 'CLO3',
        description: 'Gỡ lỗi và kiểm thử chương trình với bộ dữ liệu thử.',
        englishDescription: 'Debug and test programs with sample data.',
        cognitiveLevel: 'Vận dụng',
        plos: ['PLO4'],
      },
    ],
    weeks: [
      {
        weekLabel: 'Tuần 1',
        content:
          '<p>Tổng quan về lập trình, thuật toán và môi trường phát triển.</p>',
        teachingActivities: '<p>Giảng; cài đặt môi trường.</p>',
        clos: ['CLO1'],
      },
      {
        weekLabel: 'Tuần 2–3',
        content: '<p>Kiểu dữ liệu, biểu thức và cấu trúc điều khiển.</p>',
        teachingActivities: '<p>Giảng; thực hành trên máy.</p>',
        clos: ['CLO1', 'CLO2'],
      },
      {
        weekLabel: 'Tuần 4–5',
        content: '<p>Hàm và đệ quy.</p>',
        teachingActivities: '<p>Giảng; bài tập nhóm.</p>',
        clos: ['CLO2'],
      },
      {
        weekLabel: 'Tuần 6–7',
        content: '<p>Mảng, chuỗi và con trỏ.</p>',
        teachingActivities: '<p>Giảng; thực hành.</p>',
        clos: ['CLO2', 'CLO3'],
      },
      {
        weekLabel: 'Tuần 8',
        content: '<p>Ôn tập và kiểm tra giữa kỳ.</p>',
        teachingActivities: '<p>Kiểm tra trên máy.</p>',
        clos: ['CLO3'],
      },
    ],
  },
  {
    courseCode: 'DSA201',
    courseDescription:
      '<p>Học phần trình bày các cấu trúc dữ liệu cơ bản (danh sách, ngăn xếp, hàng đợi, cây, đồ thị) và các giải thuật tìm kiếm, sắp xếp.</p>',
    englishDescription:
      '<p>Covers core data structures and classic search and sort algorithms.</p>',
    objectives:
      '<ul><li>Chọn cấu trúc dữ liệu phù hợp với bài toán.</li><li>Phân tích độ phức tạp của giải thuật.</li></ul>',
    teachingMethods:
      '<p>Giảng lý thuyết, thực hành cài đặt trên máy, bài tập lớn.</p>',
    assessmentMethods: ASSESSMENT,
    references:
      '<ol><li>Cormen T. và cộng sự, <em>Introduction to Algorithms</em>, MIT Press.</li><li>Giáo trình Cấu trúc dữ liệu và giải thuật, Khoa CNTT.</li></ol>',
    clos: [
      {
        cloCode: 'CLO1',
        description: 'Mô tả và so sánh các cấu trúc dữ liệu cơ bản.',
        englishDescription: 'Describe and compare basic data structures.',
        cognitiveLevel: 'Hiểu',
        plos: ['PLO2'],
      },
      {
        cloCode: 'CLO2',
        description:
          'Phân tích độ phức tạp thời gian và không gian của giải thuật.',
        englishDescription: 'Analyze time and space complexity.',
        cognitiveLevel: 'Phân tích',
        plos: ['PLO2'],
      },
      {
        cloCode: 'CLO3',
        description:
          'Cài đặt cấu trúc dữ liệu và giải thuật cho bài toán cụ thể.',
        englishDescription:
          'Implement data structures and algorithms for given problems.',
        cognitiveLevel: 'Vận dụng',
        plos: ['PLO4'],
      },
    ],
    weeks: [
      {
        weekLabel: 'Tuần 1',
        content: '<p>Độ phức tạp giải thuật.</p>',
        teachingActivities: '<p>Giảng; bài tập.</p>',
        clos: ['CLO2'],
      },
      {
        weekLabel: 'Tuần 2–3',
        content: '<p>Danh sách liên kết, ngăn xếp, hàng đợi.</p>',
        teachingActivities: '<p>Giảng; thực hành cài đặt.</p>',
        clos: ['CLO1', 'CLO3'],
      },
      {
        weekLabel: 'Tuần 4–5',
        content: '<p>Cây nhị phân và cây tìm kiếm cân bằng.</p>',
        teachingActivities: '<p>Giảng; thực hành.</p>',
        clos: ['CLO1', 'CLO3'],
      },
      {
        weekLabel: 'Tuần 6–7',
        content: '<p>Các giải thuật sắp xếp và tìm kiếm.</p>',
        teachingActivities: '<p>Giảng; so sánh thời gian chạy.</p>',
        clos: ['CLO2', 'CLO3'],
      },
    ],
  },
  {
    courseCode: 'DBS201',
    courseDescription:
      '<p>Học phần giới thiệu mô hình dữ liệu quan hệ, ngôn ngữ SQL, thiết kế cơ sở dữ liệu và chuẩn hóa.</p>',
    englishDescription:
      '<p>Introduces the relational model, SQL, database design and normalization.</p>',
    objectives:
      '<ul><li>Thiết kế được lược đồ quan hệ đạt dạng chuẩn 3.</li><li>Truy vấn và cập nhật dữ liệu bằng SQL.</li></ul>',
    teachingMethods:
      '<p>Giảng lý thuyết, bài tập thiết kế, thực hành SQL trên PostgreSQL.</p>',
    assessmentMethods: ASSESSMENT,
    references:
      '<ol><li>Elmasri R., Navathe S., <em>Fundamentals of Database Systems</em>, Pearson.</li><li>Giáo trình Cơ sở dữ liệu, Khoa CNTT.</li></ol>',
    clos: [
      {
        cloCode: 'CLO1',
        description:
          'Trình bày mô hình quan hệ và các phép toán đại số quan hệ.',
        englishDescription:
          'Explain the relational model and relational algebra.',
        cognitiveLevel: 'Hiểu',
        plos: ['PLO2'],
      },
      {
        cloCode: 'CLO2',
        description:
          'Thiết kế lược đồ cơ sở dữ liệu từ yêu cầu và chuẩn hóa đến dạng chuẩn 3.',
        englishDescription:
          'Design a schema from requirements and normalize it to 3NF.',
        cognitiveLevel: 'Tạo lập',
        plos: ['PLO3'],
      },
      {
        cloCode: 'CLO3',
        description: 'Viết truy vấn SQL cho các yêu cầu khai thác dữ liệu.',
        englishDescription: 'Write SQL queries for data retrieval needs.',
        cognitiveLevel: 'Vận dụng',
        plos: ['PLO2', 'PLO3'],
      },
    ],
    weeks: [
      {
        weekLabel: 'Tuần 1',
        content:
          '<p>Tổng quan hệ cơ sở dữ liệu; mô hình thực thể – liên kết.</p>',
        teachingActivities: '<p>Giảng; thảo luận.</p>',
        clos: ['CLO1'],
      },
      {
        weekLabel: 'Tuần 2–3',
        content: '<p>Mô hình quan hệ và đại số quan hệ.</p>',
        teachingActivities: '<p>Giảng; bài tập.</p>',
        clos: ['CLO1'],
      },
      {
        weekLabel: 'Tuần 4–6',
        content:
          '<p>Ngôn ngữ SQL: truy vấn, kết nối, gom nhóm, truy vấn con.</p>',
        teachingActivities: '<p>Giảng; thực hành trên máy.</p>',
        clos: ['CLO3'],
      },
      {
        weekLabel: 'Tuần 7–8',
        content: '<p>Phụ thuộc hàm và chuẩn hóa.</p>',
        teachingActivities: '<p>Giảng; bài tập thiết kế.</p>',
        clos: ['CLO2'],
      },
    ],
  },
];

// Written through sanitizeRichText so the stored HTML is what the service would store.
const html = (value: string): string | null => sanitizeRichText(value);

async function createSyllabus(
  prisma: PrismaClient,
  courseId: string,
  demo: DemoSyllabus,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const syllabus = await tx.syllabus.create({
      data: {
        courseId,
        revisionNumber: 1,
        courseDescription: html(demo.courseDescription),
        englishDescription: html(demo.englishDescription),
        objectives: html(demo.objectives),
        teachingMethods: html(demo.teachingMethods),
        assessmentMethods: html(demo.assessmentMethods),
        references: html(demo.references),
        clos: {
          create: demo.clos.map((clo, index) => ({
            cloCode: clo.cloCode,
            description: clo.description,
            englishDescription: clo.englishDescription,
            cognitiveLevel: clo.cognitiveLevel,
            sortOrder: index + 1,
          })),
        },
      },
      include: { clos: true },
    });
    const cloId = new Map(syllabus.clos.map((clo) => [clo.cloCode, clo.id]));
    for (const [index, week] of demo.weeks.entries()) {
      await tx.weeklyContent.create({
        data: {
          syllabusId: syllabus.id,
          weekLabel: week.weekLabel,
          sortOrder: index + 1,
          content: html(week.content) ?? '',
          teachingActivities: html(week.teachingActivities),
          cloLinks: {
            create: week.clos.map((code) => ({ cloId: cloId.get(code)! })),
          },
        },
      });
    }
  });
}

// Every course of the demo frames gets a Draft revision 1 (an unreleased frame needs one to pass the consistency check);
// the three in DEMO_SYLLABI are filled in. A course that already has any syllabus is left alone.
export async function seedDemoSyllabi(prisma: PrismaClient): Promise<void> {
  for (const course of DEMO_COURSES) {
    const row = await prisma.course.findUniqueOrThrow({
      where: { courseCode: course.courseCode },
      select: { id: true },
    });
    const exists = await prisma.syllabus.findFirst({
      where: { courseId: row.id },
      select: { id: true },
    });
    if (exists) continue;
    const detailed = DEMO_SYLLABI.find(
      (d) => d.courseCode === course.courseCode,
    );
    if (detailed) {
      await createSyllabus(prisma, row.id, detailed);
    } else {
      await prisma.syllabus.create({
        data: {
          courseId: row.id,
          revisionNumber: 1,
          courseDescription: html(
            `<p>${course.courseName}: đề cương đang soạn, sẽ được nhóm chuyên môn bổ sung.</p>`,
          ),
        },
      });
    }
  }
}

// CLO -> PLO links of the detailed syllabi; each needs the course x PLO cell of the main program's frame.
export async function seedDemoCloLinks(
  prisma: PrismaClient,
  versionId: string,
): Promise<void> {
  for (const demo of DEMO_SYLLABI) {
    const item = await prisma.curriculumItem.findFirst({
      where: { versionId, course: { courseCode: demo.courseCode } },
      select: { id: true, courseId: true },
    });
    if (!item) continue;
    const syllabus = await prisma.syllabus.findFirst({
      where: { courseId: item.courseId, sourceRequestId: null },
      orderBy: { revisionNumber: 'desc' },
      include: { clos: true },
    });
    if (!syllabus) continue;
    const plos = await prisma.pLO.findMany({ where: { versionId } });
    const ploId = new Map(plos.map((p) => [p.ploCode, p.id]));
    const cloId = new Map(syllabus.clos.map((c) => [c.cloCode, c.id]));
    await prisma.cLOPLOMapping.createMany({
      data: demo.clos.flatMap((clo) =>
        clo.plos.map((code) => ({
          curriculumItemId: item.id,
          ploId: ploId.get(code)!,
          cloId: cloId.get(clo.cloCode)!,
        })),
      ),
      skipDuplicates: true,
    });
  }
}
