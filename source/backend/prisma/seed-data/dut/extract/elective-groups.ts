import { Prisma } from '../../../../src/generated/prisma/client.js';
import { LEGACY_FLAG_ON, parseElectiveNote } from '../legacy-mapping.js';

// SRS FR-84 / BR-04 / EC-04: every elective row belongs to a group with a minimum (courses or credits); there is no
// specialization entity. The school writes groups as free text in tmKhungCT.Note, so they are rebuilt here:
//  1. "Chọn k trong n" / "Chọn k TC" notes anchor a group (one per distinct note per semester).
//  2. Rows with an empty or filler note ("x", "ko", "mở") join the first anchor of the semester that still has room.
//  3. Everything else (direction labels such as "ATTT", "Mạng", unanchored rows) joins the semester's
//     "Tự chọn HKx" group. Its minimum is tmKhungTC.SoTC for the semester when the school set one.
//  4. A frame whose compulsory rows add up to more than SoTinChi − Sotuchon marks direction courses as compulsory
//     (Tuchon = 0) although students pick one direction. In a semester with ≥ 2 directions, those rows are electives.
//  5. Unbudgeted "Tự chọn HKx" groups share what remains of the total: all but the last ask for one course,
//     the last for the remaining credits.
const FILLER_NOTE = /^(|x|ko|m[ởo])$/i;
export const RESIDUAL_GROUP_NAME = (semester: number) =>
  `Tự chọn HK${semester}`;

export interface FrameRowInput {
  key: string;
  semester: number;
  courseCode: string;
  isElective: boolean;
  note: string;
}
export interface BuiltGroup {
  groupCode: string;
  groupName: string;
  minCourses: number | null;
  minCredits: string | null;
}
export interface ElectiveLayout {
  groups: BuiltGroup[];
  // Row key → group code; also the set of elective rows (a row is elective iff it has a group).
  groupOf: Map<string, string>;
  compulsoryCredits: string;
  electiveCredits: string;
  reclassifiedRows: number;
  listSizeMismatches: number;
  // compulsory + Σ group minimum = SoTinChi.
  balanced: boolean;
  requiredCredits: string;
}

interface WorkingGroup {
  group: BuiltGroup;
  rows: FrameRowInput[];
  listSize: number | null;
  residual: boolean;
  budgeted: boolean;
}

const decimal = (value: string | number) => new Prisma.Decimal(value);

export function buildElectiveLayout(input: {
  rows: readonly FrameRowInput[];
  credits: ReadonlyMap<string, string>;
  semesterBudgets: ReadonlyMap<number, string>;
  totalCredits: string;
  declaredElectiveCredits: string;
}): ElectiveLayout {
  const creditOf = (row: FrameRowInput) => {
    const credits = input.credits.get(row.courseCode);
    if (credits === undefined)
      throw new Error(`Missing course credits: ${row.courseCode}`);
    return decimal(credits);
  };
  const declaredCompulsory = decimal(input.totalCredits).minus(
    input.declaredElectiveCredits,
  );
  const flaggedCompulsory = input.rows
    .filter((row) => !row.isElective)
    .reduce((sum, row) => sum.plus(creditOf(row)), decimal(0));
  const directionsAreCompulsory =
    flaggedCompulsory.greaterThan(declaredCompulsory);
  const groups: WorkingGroup[] = [];
  const membership = new Map<string, WorkingGroup>();
  let reclassifiedRows = 0;
  const semesters = [...new Set(input.rows.map((row) => row.semester))].sort(
    (left, right) => left - right,
  );
  for (const semester of semesters) {
    const semesterRows = input.rows.filter((row) => row.semester === semester);
    const electives = semesterRows.filter((row) => row.isElective);
    let ordinal = 0;
    const anchors = new Map<string, WorkingGroup>();
    for (const row of electives) {
      const parsed = parseElectiveNote(row.note);
      if (!parsed) continue;
      const key = row.note.toLowerCase();
      let anchor = anchors.get(key);
      if (!anchor) {
        anchor = {
          group: {
            groupCode: `HK${semester}-${++ordinal}`,
            groupName: row.note,
            minCourses: parsed.minCourses ?? null,
            minCredits: parsed.minCredits ?? null,
          },
          rows: [],
          listSize: parsed.listSize ?? null,
          residual: false,
          budgeted: true,
        };
        anchors.set(key, anchor);
        groups.push(anchor);
      }
      anchor.rows.push(row);
      membership.set(row.key, anchor);
    }
    const budget = input.semesterBudgets.get(semester);
    const residual: WorkingGroup = {
      group: {
        groupCode: `HK${semester}-${ordinal + 1}`,
        groupName: RESIDUAL_GROUP_NAME(semester),
        minCourses: null,
        minCredits:
          budget !== undefined && decimal(budget).greaterThan(0)
            ? decimal(budget).toString()
            : null,
      },
      rows: [],
      listSize: null,
      residual: true,
      budgeted: budget !== undefined && decimal(budget).greaterThan(0),
    };
    const directions = new Set<string>();
    for (const row of electives) {
      if (membership.has(row.key)) continue;
      if (FILLER_NOTE.test(row.note)) {
        const open = [...anchors.values()].find(
          (anchor) =>
            anchor.listSize === null || anchor.rows.length < anchor.listSize,
        );
        if (open) {
          open.rows.push(row);
          membership.set(row.key, open);
          continue;
        }
      } else directions.add(row.note);
      residual.rows.push(row);
      membership.set(row.key, residual);
    }
    if (directionsAreCompulsory && directions.size >= 2)
      for (const row of semesterRows) {
        if (row.isElective || !row.note) continue;
        const note = row.note;
        if (
          [...directions].some(
            (direction) => note.includes(direction) || direction.includes(note),
          )
        ) {
          residual.rows.push(row);
          membership.set(row.key, residual);
          reclassifiedRows++;
        }
      }
    if (residual.rows.length) groups.push(residual);
  }

  const compulsory = input.rows
    .filter((row) => !membership.has(row.key))
    .reduce((sum, row) => sum.plus(creditOf(row)), decimal(0));
  const required = (entry: WorkingGroup) => {
    const cheapest = entry.rows
      .map(creditOf)
      .sort((left, right) => left.comparedTo(right))
      .slice(0, entry.group.minCourses ?? 0)
      .reduce((sum, credits) => sum.plus(credits), decimal(0));
    return Prisma.Decimal.max(decimal(entry.group.minCredits ?? 0), cheapest);
  };
  const pool = groups.filter((entry) => entry.residual && !entry.budgeted);
  for (const entry of pool.slice(0, -1)) entry.group.minCourses = 1;
  const last = pool.at(-1);
  if (last) {
    const others = groups
      .filter((entry) => entry !== last)
      .reduce((sum, entry) => sum.plus(required(entry)), decimal(0));
    last.group.minCredits = Prisma.Decimal.max(
      decimal(input.totalCredits).minus(compulsory).minus(others),
      0,
    ).toString();
  }
  const requiredCredits = groups.reduce(
    (sum, entry) => sum.plus(required(entry)),
    compulsory,
  );
  const reclassified = reclassifiedRows > 0;
  return {
    groups: groups.map((entry) => entry.group),
    groupOf: new Map(
      [...membership].map(([key, entry]) => [key, entry.group.groupCode]),
    ),
    compulsoryCredits: reclassified
      ? compulsory.toString()
      : declaredCompulsory.toString(),
    electiveCredits: reclassified
      ? decimal(input.totalCredits).minus(compulsory).toString()
      : decimal(input.declaredElectiveCredits).toString(),
    reclassifiedRows,
    listSizeMismatches: groups.filter(
      (entry) =>
        entry.listSize !== null && entry.listSize !== entry.rows.length,
    ).length,
    balanced: requiredCredits.equals(input.totalCredits),
    requiredCredits: requiredCredits.toString(),
  };
}

export const isElectiveFlag = (tuchon: string) => tuchon === LEGACY_FLAG_ON;
