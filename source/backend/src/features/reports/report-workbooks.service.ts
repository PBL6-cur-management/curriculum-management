import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { SyllabusStatus } from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { PERMISSIONS } from '../../shared/authz/permission-codes.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { outcomeGaps } from '../../shared/outcomes/outcome-gaps.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { richTextToPlain } from '../../shared/rich-text/rich-text-to-plain.js';
import type {
  CreditBucketDto,
  CreditDistributionDto,
  ProgramComparisonDto,
} from './dto/reports.dto.js';
import { compareVersions, creditDistribution } from './report-calculations.js';
import {
  ReportSourceReader,
  type ReportVersion,
} from './report-source.reader.js';
import { REPORT_ERRORS } from './reports.errors.js';

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const GENERIC_TEMPLATE_NOTE =
  'Mẫu tổng quát — chưa phải biểu mẫu chính thức';
const DIFFERENCE_LABELS: Record<string, string> = {
  SEMESTER: 'Học kỳ',
  CREDITS: 'Tín chỉ',
  ELECTIVE: 'Bắt buộc/tự chọn',
  BLOCK: 'Khối kiến thức',
};

export interface ReportFile {
  body: Uint8Array;
  fileName: string;
  mime: string;
}

type Row = (string | number | null)[];

function sheet(
  book: ExcelJS.Workbook,
  name: string,
  header: string[],
  rows: Row[],
) {
  const ws = book.addWorksheet(name);
  ws.addRow(header).font = { bold: true };
  rows.forEach((row) => ws.addRow(row));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  header.forEach((title, index) => {
    ws.getColumn(index + 1).width = Math.min(
      60,
      Math.max(10, title.length + 4),
    );
  });
  return ws;
}

const label = (version: ReportVersion) =>
  `${version.programCode}${version.versionNumber ? `-v${version.versionNumber}` : '-nhap'}`;
const yesNo = (value: boolean) => (value ? 'Tự chọn' : 'Bắt buộc');

async function finish(
  book: ExcelJS.Workbook,
  fileName: string,
): Promise<ReportFile> {
  return {
    body: new Uint8Array(await book.xlsx.writeBuffer()),
    fileName,
    mime: XLSX_MIME,
  };
}

function bucketRows(rows: CreditBucketDto[]): Row[] {
  return rows.map((row) => [
    row.label,
    row.courseCount,
    Number(row.compulsory),
    Number(row.elective),
    Number(row.total),
  ]);
}
const BUCKET_HEADER = [
  'Nhóm',
  'Số học phần',
  'Bắt buộc (TC)',
  'Tự chọn được mở (TC)',
  'Tổng (TC)',
];

@Injectable()
export class ReportWorkbooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly source: ReportSourceReader,
  ) {}

  async blockNames(): Promise<Map<string, string>> {
    const rows = await this.prisma.knowledgeBlock.findMany({
      select: { blockCode: true, blockName: true },
    });
    return new Map(rows.map((row) => [row.blockCode, row.blockName]));
  }

  async comparison(access: AccessContext, leftId: string, rightId: string) {
    const [left, right] = await Promise.all([
      this.source.read(access, leftId, PERMISSIONS.REPORT_BENCHMARK),
      this.source.read(access, rightId, PERMISSIONS.REPORT_BENCHMARK),
    ]);
    if (left.programId === right.programId)
      throw new AppException(REPORT_ERRORS.SAME_PROGRAM);
    return { left, right, result: compareVersions(left, right) };
  }

  async distribution(access: AccessContext, versionId: string) {
    const version = await this.source.read(
      access,
      versionId,
      PERMISSIONS.REPORT_BENCHMARK,
    );
    return {
      version,
      result: creditDistribution(version, await this.blockNames()),
    };
  }

  async comparisonFile(
    access: AccessContext,
    leftId: string,
    rightId: string,
  ): Promise<ReportFile> {
    const { left, right, result } = await this.comparison(
      access,
      leftId,
      rightId,
    );
    const book = new ExcelJS.Workbook();
    this.comparisonSheets(book, left, right, result);
    return finish(book, `so-sanh-${label(left)}-${label(right)}.xlsx`);
  }

  private comparisonSheets(
    book: ExcelJS.Workbook,
    left: ReportVersion,
    right: ReportVersion,
    result: ProgramComparisonDto,
  ) {
    sheet(
      book,
      'TomTat',
      ['Mục', label(left), label(right)],
      [
        ['Chương trình', left.programName, right.programName],
        [
          'Tổng tín chỉ công bố',
          Number(left.totalCredits),
          Number(right.totalCredits),
        ],
        [
          'Học phần chung',
          result.summary.sharedCount,
          result.summary.sharedCount,
        ],
        [
          'Tín chỉ học phần chung',
          Number(result.summary.sharedCreditsLeft),
          Number(result.summary.sharedCreditsRight),
        ],
        [
          'Cặp tương đương',
          result.summary.equivalentCount,
          result.summary.equivalentCount,
        ],
        [
          'Chỉ có ở chương trình này',
          result.summary.leftOnlyCount,
          result.summary.rightOnlyCount,
        ],
      ],
    );
    sheet(
      book,
      'HocPhanChung',
      [
        'Mã HP',
        'Tên HP',
        `HK ${label(left)}`,
        `TC ${label(left)}`,
        `Loại ${label(left)}`,
        `HK ${label(right)}`,
        `TC ${label(right)}`,
        `Loại ${label(right)}`,
        'Khác nhau',
      ],
      result.shared.map((row) => [
        row.courseCode,
        row.courseName,
        row.left!.plannedSemester,
        Number(row.left!.credits),
        yesNo(row.left!.isElective),
        row.right!.plannedSemester,
        Number(row.right!.credits),
        yesNo(row.right!.isElective),
        row.differences.map((key) => DIFFERENCE_LABELS[key] ?? key).join(', '),
      ]),
    );
    sheet(
      book,
      'TuongDuong',
      [
        `Mã HP ${label(left)}`,
        'Tên HP',
        'TC',
        `Mã HP ${label(right)}`,
        'Tên HP',
        'TC',
      ],
      result.equivalent.map((pair) => [
        pair.left.courseCode,
        pair.left.courseName,
        Number(pair.left.left!.credits),
        pair.right.courseCode,
        pair.right.courseName,
        Number(pair.right.right!.credits),
      ]),
    );
    for (const [name, rows, key] of [
      ['RiengTrai', result.leftOnly, 'left'],
      ['RiengPhai', result.rightOnly, 'right'],
    ] as const)
      sheet(
        book,
        name,
        ['Mã HP', 'Tên HP', 'Học kỳ', 'Tín chỉ', 'Loại'],
        rows.map((row) => [
          row.courseCode,
          row.courseName,
          row[key]!.plannedSemester,
          Number(row[key]!.credits),
          yesNo(row[key]!.isElective),
        ]),
      );
  }

  async distributionFile(
    access: AccessContext,
    versionId: string,
  ): Promise<ReportFile> {
    const { version, result } = await this.distribution(access, versionId);
    const book = new ExcelJS.Workbook();
    this.distributionSheets(book, result);
    return finish(book, `phan-bo-tin-chi-${label(version)}.xlsx`);
  }

  private distributionSheets(
    book: ExcelJS.Workbook,
    result: CreditDistributionDto,
  ) {
    const totals = result.totals;
    sheet(
      book,
      'TongHop',
      ['Mục', 'Tín chỉ'],
      [
        ['Tổng tín chỉ các dòng', Number(totals.allRows)],
        ['Bắt buộc', Number(totals.compulsory)],
        ['Tự chọn được mở', Number(totals.electiveOffered)],
        [
          `Yêu cầu tốt nghiệp (bắt buộc + tối thiểu tự chọn)${totals.requiredIsPartial ? ' — có nhóm chưa khai báo tối thiểu' : ''}`,
          Number(totals.required),
        ],
        ['Tổng công bố của phiên bản', Number(totals.declaredTotal)],
      ],
    );
    sheet(book, 'KhoiKienThuc', BUCKET_HEADER, bucketRows(result.byBlock));
    sheet(book, 'HocKy', BUCKET_HEADER, bucketRows(result.bySemester));
    sheet(book, 'LoaiHocPhan', BUCKET_HEADER, bucketRows(result.byCourseType));
    sheet(
      book,
      'NhomTuChon',
      ['Mã nhóm', 'Tên nhóm', 'Tối thiểu TC', 'Tối thiểu số HP', 'TC được mở'],
      result.electiveGroups.map((group) => [
        group.groupCode,
        group.groupName,
        group.minCredits === null ? null : Number(group.minCredits),
        group.minCourses,
        Number(group.offeredCredits),
      ]),
    );
  }

  private async closByRevision(version: ReportVersion) {
    const ids = [
      ...new Set(
        version.items.flatMap((item) =>
          item.revision ? [item.revision.id] : [],
        ),
      ),
    ];
    const rows = ids.length
      ? await this.prisma.cLO.findMany({
          where: { syllabusId: { in: ids } },
          orderBy: [{ sortOrder: 'asc' }, { cloCode: 'asc' }],
          select: {
            id: true,
            syllabusId: true,
            cloCode: true,
            description: true,
          },
        })
      : [];
    const map = new Map<string, typeof rows>();
    for (const row of rows)
      map.set(row.syllabusId, [...(map.get(row.syllabusId) ?? []), row]);
    return map;
  }

  // The stored numbers, as the screen shows them: a blank cell is "no contribution", never a zero guessed in.
  private async matrixSheets(book: ExcelJS.Workbook, version: ReportVersion) {
    const weight = new Map(
      version.cells.map((cell) => [
        `${cell.curriculumItemId}:${cell.ploId}`,
        Number(cell.weight),
      ]),
    );
    sheet(
      book,
      'HocPhan_PLO',
      ['Mã HP', 'Tên HP', 'Học kỳ', ...version.plos.map((plo) => plo.ploCode)],
      version.items.map((item) => [
        item.courseCode,
        item.courseName,
        item.plannedSemester,
        ...version.plos.map(
          (plo) => weight.get(`${item.id}:${plo.id}`) ?? null,
        ),
      ]),
    );
    const links = new Set(
      version.cloLinks.map(
        (link) => `${link.curriculumItemId}:${link.cloId}:${link.ploId}`,
      ),
    );
    const clos = await this.closByRevision(version);
    sheet(
      book,
      'CLO_PLO',
      [
        'Mã HP',
        'Lần ban hành đề cương',
        'CLO',
        'Mô tả CLO',
        ...version.plos.map((plo) => plo.ploCode),
      ],
      version.items.flatMap((item) =>
        (item.revision ? (clos.get(item.revision.id) ?? []) : []).map((clo) => [
          item.courseCode,
          item.revision!.revisionNumber,
          clo.cloCode,
          clo.description,
          ...version.plos.map((plo) =>
            links.has(`${item.id}:${clo.id}:${plo.id}`) ? 'x' : null,
          ),
        ]),
      ),
    );
    return clos;
  }

  async matricesFile(
    access: AccessContext,
    versionId: string,
  ): Promise<ReportFile> {
    const version = await this.source.read(
      access,
      versionId,
      PERMISSIONS.REPORT_EXPORT_ACCREDITATION,
    );
    const book = new ExcelJS.Workbook();
    await this.matrixSheets(book, version);
    return finish(book, `ma-tran-${label(version)}.xlsx`);
  }

  // One generic workbook for a released version. Missing grading blocks it: an incomplete dossier must not look complete.
  async accreditationFile(
    access: AccessContext,
    versionId: string,
  ): Promise<ReportFile> {
    const version = await this.source.read(
      access,
      versionId,
      PERMISSIONS.REPORT_EXPORT_ACCREDITATION,
      {
        issuedOnly: true,
      },
    );
    const pinIds = version.items.flatMap((item) =>
      item.syllabusId ? [item.syllabusId] : [],
    );
    const syllabi = await this.prisma.syllabus.findMany({
      where: { id: { in: pinIds } },
      select: {
        id: true,
        status: true,
        revisionNumber: true,
        courseDescription: true,
        objectives: true,
        teachingMethods: true,
        assessmentComponents: {
          orderBy: { componentCode: 'asc' },
          select: {
            componentCode: true,
            componentName: true,
            weight: true,
            assessmentForm: true,
            isConditional: true,
            conditionThreshold: true,
            failingScore: true,
          },
        },
      },
    });
    const byId = new Map(syllabi.map((row) => [row.id, row]));
    const missing = version.items.filter((item) => {
      const pin = item.syllabusId ? byId.get(item.syllabusId) : undefined;
      return (
        !pin ||
        pin.status === SyllabusStatus.DRAFT ||
        pin.revisionNumber === null ||
        pin.assessmentComponents.length === 0
      );
    });
    if (missing.length)
      throw new AppException(
        REPORT_ERRORS.GRADING_UNAVAILABLE,
        missing.map((item) => ({
          field: item.courseCode,
          constraints: ['gradingMissing'],
        })),
      );

    const book = new ExcelJS.Workbook();
    const distribution = creditDistribution(version, await this.blockNames());
    sheet(
      book,
      'ThongTin',
      ['Mục', 'Giá trị'],
      [
        ['Loại tài liệu', GENERIC_TEMPLATE_NOTE],
        ['Mã chương trình', version.programCode],
        ['Tên chương trình', version.programName],
        ['Ngành', `${version.majorCode} — ${version.majorName}`],
        ['Phiên bản', version.versionNumber],
        ['Số quyết định', version.decisionNumber],
        [
          'Ngày ban hành',
          version.publishedAt?.toISOString().slice(0, 10) ?? null,
        ],
        ['Số học kỳ', version.semesterCount],
        ['Tổng tín chỉ', Number(version.totalCredits)],
        [
          'Ghi chú',
          'Tên, tín chỉ, PLO/CLO và đề cương lấy theo phiên bản đã ban hành; nhóm khối kiến thức và loại học phần là dữ liệu hiện tại.',
        ],
      ],
    );
    sheet(
      book,
      'KhungCTDT',
      [
        'Học kỳ',
        'Mã HP',
        'Tên HP',
        'Tín chỉ',
        'Loại',
        'Nhóm tự chọn',
        'Khối kiến thức',
      ],
      version.items.map((item) => [
        item.plannedSemester,
        item.courseCode,
        item.courseName,
        Number(item.credits),
        yesNo(item.isElective),
        item.electiveGroupCode,
        item.blockSymbol,
      ]),
    );
    sheet(
      book,
      'PLO',
      ['Mã PLO', 'Mô tả', 'Nhóm năng lực'],
      version.plos.map((plo) => [
        plo.ploCode,
        plo.description,
        plo.competencyGroup,
      ]),
    );
    const clos = await this.matrixSheets(book, version);
    this.distributionSheets(book, distribution);
    sheet(
      book,
      'DeCuong',
      [
        'Mã HP',
        'Lần ban hành',
        'Mô tả học phần',
        'Mục tiêu',
        'Phương pháp giảng dạy',
      ],
      version.items.map((item) => {
        const pin = byId.get(item.syllabusId!)!;
        return [
          item.courseCode,
          pin.revisionNumber,
          richTextToPlain(pin.courseDescription),
          richTextToPlain(pin.objectives),
          richTextToPlain(pin.teachingMethods),
        ];
      }),
    );
    sheet(
      book,
      'DanhGia',
      [
        'Mã HP',
        'Mã thành phần',
        'Tên thành phần',
        'Trọng số (%)',
        'Hình thức',
        'Điều kiện',
        'Ngưỡng điều kiện',
        'Điểm liệt',
      ],
      version.items.flatMap((item) =>
        byId
          .get(item.syllabusId!)!
          .assessmentComponents.map((component) => [
            item.courseCode,
            component.componentCode,
            component.componentName,
            Number(toWireDecimal(component.weight)),
            component.assessmentForm,
            component.isConditional ? 'Có' : 'Không',
            component.conditionThreshold === null
              ? null
              : Number(component.conditionThreshold),
            component.failingScore === null
              ? null
              : Number(component.failingScore),
          ]),
      ),
    );
    const gaps = outcomeGaps({
      plos: version.plos,
      items: version.items.map((item) => ({
        itemId: item.id,
        plannedSemester: item.plannedSemester,
        courseCode: item.courseCode,
        courseName: item.courseName,
        ownerGroupId: null,
        clos: item.revision
          ? (clos.get(item.revision.id) ?? []).map((clo) => ({
              id: clo.id,
              cloCode: clo.cloCode,
              description: clo.description,
            }))
          : null,
      })),
      cells: version.cells,
      links: version.cloLinks,
    });
    sheet(
      book,
      'LoHong',
      ['Loại lỗ hổng', 'Đối tượng', 'Mô tả'],
      [
        ...gaps.plosWithoutCourse.map((plo) => [
          'PLO chưa có học phần đóng góp',
          plo.ploCode,
          plo.description,
        ]),
        ...gaps.coursesWithoutPlo.map((course) => [
          'Học phần chưa đóng góp PLO nào',
          course.courseCode,
          course.courseName,
        ]),
        ...gaps.closWithoutPlo.map((clo) => [
          'CLO chưa liên kết PLO',
          `${clo.courseCode} ${clo.cloCode}`,
          clo.cloDescription,
        ]),
        ...gaps.coursesWithoutSyllabus.map((course) => [
          'Học phần chưa có đề cương',
          course.courseCode,
          course.courseName,
        ]),
      ],
    );
    return finish(book, `ho-so-kiem-dinh-${label(version)}.xlsx`);
  }
}
