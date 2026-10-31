import { createHash } from 'node:crypto';
import type pg from 'pg';
import { BACKUP_POLICY } from './backup.constants.js';
import type { FileEvidence, ReleaseEvidence } from './backup.types.js';

type Row = Record<string, string | null>;

// Projection v1 (BE-04): the stored scalar columns of every non-Draft version's frozen graph, never `updatedAt`
// and never the live course catalog. Two later columns (Syllabus.failingScore, SyllabusAttachment.materialKind)
// joined the frozen list when this was built. Changing a list means a new PROJECTION_VERSION.
export const PROJECTION_COLUMNS = {
  ProgramVersion: [
    'id',
    'programId',
    'versionNumber',
    'status',
    'programName',
    'majorCode',
    'majorName',
    'semesterCount',
    'totalCredits',
    'compulsoryCredits',
    'electiveCredits',
    'creditMismatchReason',
    'creditMismatchCompulsoryGap',
    'creditMismatchElectiveGap',
    'creditMismatchAcceptedById',
    'creditMismatchAcceptedAt',
    'sourceRequestId',
    'baseVersionId',
    'decisionNumber',
    'signedDate',
    'effectiveSemesterId',
    'publishedById',
    'publishedAt',
    'previousVersionId',
    'originRequestId',
    'correctionOfId',
    'correctionReason',
    'createdAt',
  ],
  Semester: [
    'id',
    'semesterCode',
    'academicYear',
    'termInYear',
    'startDate',
    'createdAt',
  ],
  CurriculumItem: [
    'id',
    'versionId',
    'plannedSemester',
    'sortOrder',
    'courseId',
    'blockSymbol',
    'isElective',
    'electiveGroupId',
    'htDa',
    'tqDa',
    'minStudiedScore',
    'minTransferScore',
    'note',
    'courseNameSnapshot',
    'creditsSnapshot',
    'syllabusId',
    'createdAt',
  ],
  CurriculumRequisite: [
    'id',
    'itemId',
    'sourceCourseId',
    'relationType',
    'minScore',
    'createdAt',
  ],
  ElectiveGroup: [
    'id',
    'versionId',
    'groupCode',
    'groupName',
    'minCredits',
    'minCourses',
    'createdAt',
  ],
  PLO: [
    'id',
    'versionId',
    'ploCode',
    'description',
    'englishDescription',
    'competencyGroup',
    'sortOrder',
    'createdAt',
  ],
  CoursePLOMapping: ['id', 'curriculumItemId', 'ploId', 'weight', 'createdAt'],
  CLOPLOMapping: ['id', 'curriculumItemId', 'ploId', 'cloId', 'createdAt'],
  Syllabus: [
    'id',
    'courseId',
    'revisionNumber',
    'status',
    'courseDescription',
    'englishDescription',
    'objectives',
    'teachingMethods',
    'assessmentMethods',
    'references',
    'failingScore',
    'previousVersionId',
    'publishedAt',
    'sourceRequestId',
    'baseRevisionId',
    'originRequestId',
    'createdAt',
  ],
  WeeklyContent: [
    'id',
    'syllabusId',
    'weekLabel',
    'sortOrder',
    'content',
    'teachingActivities',
  ],
  CLO: [
    'id',
    'syllabusId',
    'cloCode',
    'description',
    'englishDescription',
    'cognitiveLevel',
    'sortOrder',
    'createdAt',
  ],
  WeeklyContentCLO: ['id', 'weeklyContentId', 'cloId'],
  SyllabusAttachment: [
    'id',
    'syllabusId',
    'fileName',
    'fileType',
    'materialKind',
    'filePath',
    'sizeBytes',
    'uploadedById',
    'recordedAt',
  ],
  CohortVersion: [
    'id',
    'cohortId',
    'programVersionId',
    'fromSemesterId',
    'createdAt',
  ],
} as const;

export type ProjectionNode = keyof typeof PROJECTION_COLUMNS;

export interface ReleasedContentRows {
  versions: { versionId: string; nodes: Record<ProjectionNode, Row[]> }[];
}

export interface ReleasedContentProjection {
  projectionVersion: number;
  versions: ReleaseEvidence[];
}

// Every value as PostgreSQL's own text form: Decimal keeps its digits, timestamps keep their exact value.
async function select(
  client: pg.Client,
  node: ProjectionNode,
  column: string,
  ids: readonly string[],
): Promise<Row[]> {
  if (ids.length === 0) return [];
  const columns = PROJECTION_COLUMNS[node]
    .map((c) => `t."${c}"::text AS "${c}"`)
    .join(', ');
  const { rows } = await client.query<Row>(
    `SELECT ${columns} FROM "${node}" t WHERE t."${column}"::text = ANY($1::text[]) ORDER BY t."id"`,
    [ids],
  );
  return rows;
}

const ids = (rows: Row[], column = 'id') => [
  ...new Set(rows.flatMap((row) => (row[column] ? [row[column]] : []))),
];
const where = (rows: Row[], column: string, values: readonly string[]) => {
  const set = new Set(values);
  return rows.filter((row) => row[column] !== null && set.has(row[column]));
};

// Reads on the caller's client, so a backup reads at its exported snapshot and a drill at its target.
export async function readReleasedRows(
  client: pg.Client,
): Promise<ReleasedContentRows> {
  const { rows: versionIds } = await client.query<{ id: string }>(
    `SELECT id FROM "ProgramVersion" WHERE status::text <> 'DRAFT' ORDER BY id`,
  );
  const allVersions = versionIds.map((row) => row.id);
  const versions = await select(client, 'ProgramVersion', 'id', allVersions);
  const items = await select(
    client,
    'CurriculumItem',
    'versionId',
    allVersions,
  );
  const itemIds = ids(items);
  const requisites = await select(
    client,
    'CurriculumRequisite',
    'itemId',
    itemIds,
  );
  const groups = await select(
    client,
    'ElectiveGroup',
    'versionId',
    allVersions,
  );
  const plos = await select(client, 'PLO', 'versionId', allVersions);
  const coursePlo = await select(
    client,
    'CoursePLOMapping',
    'curriculumItemId',
    itemIds,
  );
  const cloPlo = await select(
    client,
    'CLOPLOMapping',
    'curriculumItemId',
    itemIds,
  );
  const syllabi = await select(
    client,
    'Syllabus',
    'id',
    ids(items, 'syllabusId'),
  );
  const syllabusIds = ids(syllabi);
  const weekly = await select(
    client,
    'WeeklyContent',
    'syllabusId',
    syllabusIds,
  );
  const clos = await select(client, 'CLO', 'syllabusId', syllabusIds);
  const weeklyClo = await select(
    client,
    'WeeklyContentCLO',
    'weeklyContentId',
    ids(weekly),
  );
  const attachments = await select(
    client,
    'SyllabusAttachment',
    'syllabusId',
    syllabusIds,
  );
  const cohorts = await select(
    client,
    'CohortVersion',
    'programVersionId',
    allVersions,
  );
  const semesters = await select(client, 'Semester', 'id', [
    ...ids(versions, 'effectiveSemesterId'),
    ...ids(cohorts, 'fromSemesterId'),
  ]);

  return {
    versions: versions.map((version) => {
      const versionId = version.id!;
      const ownItems = where(items, 'versionId', [versionId]);
      const ownItemIds = ids(ownItems);
      const ownSyllabi = where(syllabi, 'id', ids(ownItems, 'syllabusId'));
      const ownSyllabusIds = ids(ownSyllabi);
      const ownWeekly = where(weekly, 'syllabusId', ownSyllabusIds);
      const ownCohorts = where(cohorts, 'programVersionId', [versionId]);
      return {
        versionId,
        nodes: {
          ProgramVersion: [version],
          Semester: where(semesters, 'id', [
            ...ids([version], 'effectiveSemesterId'),
            ...ids(ownCohorts, 'fromSemesterId'),
          ]),
          CurriculumItem: ownItems,
          CurriculumRequisite: where(requisites, 'itemId', ownItemIds),
          ElectiveGroup: where(groups, 'versionId', [versionId]),
          PLO: where(plos, 'versionId', [versionId]),
          CoursePLOMapping: where(coursePlo, 'curriculumItemId', ownItemIds),
          CLOPLOMapping: where(cloPlo, 'curriculumItemId', ownItemIds),
          Syllabus: ownSyllabi,
          WeeklyContent: ownWeekly,
          CLO: where(clos, 'syllabusId', ownSyllabusIds),
          WeeklyContentCLO: where(weeklyClo, 'weeklyContentId', ids(ownWeekly)),
          SyllabusAttachment: where(attachments, 'syllabusId', ownSyllabusIds),
          CohortVersion: ownCohorts,
        },
      };
    }),
  };
}

// Sorted keys at every level: the same data always serialises to the same bytes.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (text: string) =>
  createHash('sha256').update(text, 'utf8').digest('hex');

// Attachment rows carry the hash of their copied bytes, so a swapped signed file changes the version digest.
export function fingerprintReleasedContent(
  rows: ReleasedContentRows,
  files: readonly FileEvidence[],
): ReleasedContentProjection {
  const hashByPath = new Map(files.map((file) => [file.path, file.sha256]));
  const versions = rows.versions
    .map(({ versionId, nodes }) => {
      const nodeDigests: Record<string, string> = {};
      const rowCounts: Record<string, number> = {};
      for (const node of Object.keys(PROJECTION_COLUMNS) as ProjectionNode[]) {
        const nodeRows = [...nodes[node]]
          .map((row) =>
            node === 'SyllabusAttachment'
              ? { ...row, sha256: hashByPath.get(row.filePath ?? '') ?? null }
              : row,
          )
          .sort((a, b) => ((a.id ?? '') < (b.id ?? '') ? -1 : 1));
        nodeDigests[node] = sha256(canonicalJson(nodeRows));
        rowCounts[node] = nodeRows.length;
      }
      return {
        versionId,
        sha256: sha256(canonicalJson({ nodeDigests, rowCounts })),
        nodeDigests,
        rowCounts,
      };
    })
    .sort((a, b) => (a.versionId < b.versionId ? -1 : 1));
  return { projectionVersion: BACKUP_POLICY.PROJECTION_VERSION, versions };
}

// Which versions differ, and in which node: for drill checks and upgrade comparisons.
export function compareReleases(
  expected: readonly ReleaseEvidence[],
  actual: readonly ReleaseEvidence[],
): string[] {
  const problems: string[] = [];
  const byId = new Map(actual.map((version) => [version.versionId, version]));
  for (const version of expected) {
    const found = byId.get(version.versionId);
    if (!found) {
      problems.push(`thiếu phiên bản ${version.versionId}`);
      continue;
    }
    for (const [node, digest] of Object.entries(version.nodeDigests)) {
      if (found.nodeDigests[node] !== digest) {
        problems.push(`phiên bản ${version.versionId}: ${node} khác`);
      }
    }
  }
  return problems;
}
