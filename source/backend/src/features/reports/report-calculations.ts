import { Prisma } from '../../generated/prisma/client.js';
import { toWireDecimal } from '../../shared/decimal/decimal.js';
import type {
  ComparisonCourseDto,
  CreditBucketDto,
  CreditDistributionDto,
  ProgramComparisonDto,
  ReportVersionRefDto,
} from './dto/reports.dto.js';
import type { ReportItem, ReportVersion } from './report-source.reader.js';

const ZERO = new Prisma.Decimal(0);
const sum = (values: Prisma.Decimal[]) =>
  values.reduce((total, value) => total.plus(value), ZERO);

export const COURSE_TYPE_LABELS: Record<string, string> = {
  THEORY: 'Lý thuyết',
  PRACTICE: 'Thực hành',
  LAB: 'Thí nghiệm',
  PROJECT: 'Đồ án',
  CAPSTONE: 'Đồ án tốt nghiệp',
  INTERNSHIP: 'Thực tập',
  CONDITIONAL: 'Điều kiện',
};
export const NO_BLOCK_LABEL = 'Chưa gán khối kiến thức';

export function versionRef(version: ReportVersion): ReportVersionRefDto {
  return {
    id: version.id,
    programCode: version.programCode,
    programName: version.programName,
    versionNumber: version.versionNumber,
    status: version.status,
    totalCredits: toWireDecimal(version.totalCredits),
  };
}

function side(item: ReportItem) {
  return {
    plannedSemester: item.plannedSemester,
    credits: toWireDecimal(item.credits),
    isElective: item.isElective,
    blockSymbol: item.blockSymbol,
  };
}

function course(
  item: ReportItem,
  which: 'left' | 'right',
): ComparisonCourseDto {
  return {
    courseCode: item.courseCode,
    courseName: item.courseName,
    left: which === 'left' ? side(item) : null,
    right: which === 'right' ? side(item) : null,
    differences: [],
  };
}

// Deterministic: same course id = shared; otherwise an unmatched pair in one equivalence group = equivalent.
// Within a group, pairs follow course code order on each side; the rest stay exclusive.
export function compareVersions(
  left: ReportVersion,
  right: ReportVersion,
): ProgramComparisonDto {
  const rightByCourse = new Map(
    right.items.map((item) => [item.courseId, item]),
  );
  const leftCourses = new Set(left.items.map((item) => item.courseId));
  const shared: ComparisonCourseDto[] = [];
  const leftRest: ReportItem[] = [];
  for (const item of left.items) {
    const other = rightByCourse.get(item.courseId);
    if (!other) {
      leftRest.push(item);
      continue;
    }
    const differences: string[] = [];
    if (item.plannedSemester !== other.plannedSemester)
      differences.push('SEMESTER');
    if (!item.credits.equals(other.credits)) differences.push('CREDITS');
    if (item.isElective !== other.isElective) differences.push('ELECTIVE');
    if (item.blockSymbol !== other.blockSymbol) differences.push('BLOCK');
    shared.push({
      courseCode: item.courseCode,
      courseName: item.courseName,
      left: side(item),
      right: side(other),
      differences,
    });
  }
  const rightRest = right.items.filter(
    (item) => !leftCourses.has(item.courseId),
  );
  const byCode = (a: ReportItem, b: ReportItem) =>
    a.courseCode.localeCompare(b.courseCode);
  const equivalent: ProgramComparisonDto['equivalent'] = [];
  const pairedLeft = new Set<string>();
  const pairedRight = new Set<string>();
  const groups = new Set(
    leftRest.flatMap((item) =>
      item.equivalenceGroupId ? [item.equivalenceGroupId] : [],
    ),
  );
  for (const group of [...groups].sort()) {
    const lefts = leftRest
      .filter((item) => item.equivalenceGroupId === group)
      .sort(byCode);
    const rights = rightRest
      .filter((item) => item.equivalenceGroupId === group)
      .sort(byCode);
    for (
      let index = 0;
      index < Math.min(lefts.length, rights.length);
      index += 1
    ) {
      equivalent.push({
        left: course(lefts[index]!, 'left'),
        right: course(rights[index]!, 'right'),
      });
      pairedLeft.add(lefts[index]!.id);
      pairedRight.add(rights[index]!.id);
    }
  }
  const leftOnly = leftRest
    .filter((item) => !pairedLeft.has(item.id))
    .map((item) => course(item, 'left'));
  const rightOnly = rightRest
    .filter((item) => !pairedRight.has(item.id))
    .map((item) => course(item, 'right'));
  return {
    left: versionRef(left),
    right: versionRef(right),
    summary: {
      sharedCount: shared.length,
      equivalentCount: equivalent.length,
      leftOnlyCount: leftOnly.length,
      rightOnlyCount: rightOnly.length,
      sharedCreditsLeft: toWireDecimal(
        sum(shared.map((row) => new Prisma.Decimal(row.left!.credits))),
      ),
      sharedCreditsRight: toWireDecimal(
        sum(shared.map((row) => new Prisma.Decimal(row.right!.credits))),
      ),
    },
    shared,
    equivalent,
    leftOnly,
    rightOnly,
  };
}

function buckets(
  items: ReportItem[],
  keyOf: (item: ReportItem) => string,
  labelOf: (key: string) => string,
  order: (a: string, b: string) => number,
): CreditBucketDto[] {
  const groups = new Map<string, ReportItem[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => order(a, b))
    .map(([key, rows]) => {
      const compulsory = sum(
        rows.filter((row) => !row.isElective).map((row) => row.credits),
      );
      const elective = sum(
        rows.filter((row) => row.isElective).map((row) => row.credits),
      );
      return {
        key,
        label: labelOf(key),
        compulsory: toWireDecimal(compulsory),
        elective: toWireDecimal(elective),
        total: toWireDecimal(compulsory.plus(elective)),
        courseCount: rows.length,
      };
    });
}

// Every row's credits are distributed; an elective group's minimum is a requirement shown beside the
// distribution, never spread over semesters (BR-04). Every bucket table sums to totals.allRows.
export function creditDistribution(
  version: ReportVersion,
  blockNames: ReadonlyMap<string, string>,
): CreditDistributionDto {
  const compulsory = sum(
    version.items
      .filter((item) => !item.isElective)
      .map((item) => item.credits),
  );
  const electiveOffered = sum(
    version.items.filter((item) => item.isElective).map((item) => item.credits),
  );
  const minimums = version.electiveGroups.map((group) => group.minCredits);
  const typeOrder = Object.keys(COURSE_TYPE_LABELS);
  return {
    version: versionRef(version),
    totals: {
      allRows: toWireDecimal(compulsory.plus(electiveOffered)),
      compulsory: toWireDecimal(compulsory),
      electiveOffered: toWireDecimal(electiveOffered),
      required: toWireDecimal(
        compulsory.plus(
          sum(minimums.flatMap((value) => (value ? [value] : []))),
        ),
      ),
      declaredTotal: toWireDecimal(version.totalCredits),
      declaredCompulsory: toWireDecimal(version.compulsoryCredits),
      declaredElective: toWireDecimal(version.electiveCredits),
      requiredIsPartial: minimums.some((value) => value === null),
    },
    byBlock: buckets(
      version.items,
      (item) => item.blockSymbol ?? '',
      (key) => (key ? (blockNames.get(key) ?? key) : NO_BLOCK_LABEL),
      (a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)),
    ),
    bySemester: buckets(
      version.items,
      (item) => String(item.plannedSemester),
      (key) => `Học kỳ ${key}`,
      (a, b) => Number(a) - Number(b),
    ),
    byCourseType: buckets(
      version.items,
      (item) => item.courseType,
      (key) => COURSE_TYPE_LABELS[key] ?? key,
      (a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b),
    ),
    electiveGroups: version.electiveGroups.map((group) => ({
      groupCode: group.groupCode,
      groupName: group.groupName,
      minCredits: group.minCredits ? toWireDecimal(group.minCredits) : null,
      minCourses: group.minCourses,
      offeredCredits: toWireDecimal(
        sum(
          version.items
            .filter((item) => item.electiveGroupCode === group.groupCode)
            .map((item) => item.credits),
        ),
      ),
    })),
  };
}
