import {
  ImportType,
  ProgramVersionStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import type { AccessContext } from '../../shared/authz/access-context.js';
import { assertDirectEdit } from '../../shared/authz/edit-path.js';
import {
  PERMISSIONS,
  type PermissionCode,
} from '../../shared/authz/permission-codes.js';
import { AppException } from '../../shared/exception/app.exception.js';
import { COMMON_ERRORS } from '../../shared/exception/error-codes.js';
import {
  programEditState,
  programTarget,
} from '../../shared/programs/program-target.js';
import { holdsStudentImport } from '../../shared/students/student-access.js';
import { IMPORT_ERRORS } from './import-errors.js';

// Personal data: visible to a current R1 import holder only, never through ownership or a broad permission held elsewhere.
export const STUDENT_IMPORT_TYPES: readonly ImportType[] = [
  ImportType.STUDENT_LIST,
  ImportType.ACADEMIC_RESULT,
];
export const isStudentImportType = (importType: ImportType): boolean =>
  STUDENT_IMPORT_TYPES.includes(importType);

export const IMPORT_TYPE_SUPPORT = {
  COURSE_CATALOG: { enabled: true, needsVersion: false },
  CURRICULUM: { enabled: true, needsVersion: true },
  STUDENT_LIST: { enabled: true, needsVersion: false },
  ACADEMIC_RESULT: { enabled: true, needsVersion: false },
} as const satisfies Record<
  ImportType,
  { enabled: boolean; needsVersion: boolean }
>;
export const IMPORT_PERMISSION = {
  COURSE_CATALOG: PERMISSIONS.DATA_IMPORT_EXCEL,
  CURRICULUM: PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
  STUDENT_LIST: PERMISSIONS.DATA_IMPORT_EXCEL,
  ACADEMIC_RESULT: PERMISSIONS.DATA_IMPORT_EXCEL,
} as const satisfies Record<ImportType, PermissionCode>;

export function assertSupported(importType: ImportType): void {
  if (!IMPORT_TYPE_SUPPORT[importType].enabled)
    throw new AppException(IMPORT_ERRORS.TYPE_UNAVAILABLE);
}
export function assertCatalogImport(access: AccessContext): void {
  if (!access.scopeFor(PERMISSIONS.DATA_IMPORT_EXCEL).all)
    throw new AppException(
      access.has(PERMISSIONS.DATA_IMPORT_EXCEL)
        ? COMMON_ERRORS.OUT_OF_SCOPE
        : COMMON_ERRORS.PERMISSION_DENIED,
    );
}
export const IMPORT_VERSION_SELECT = {
  id: true,
  status: true,
  programId: true,
  sourceRequestId: true,
  correctionOfId: true,
  program: { select: { id: true, facultyId: true } },
} as const satisfies Prisma.ProgramVersionSelect;
export type ImportVersionRow = Prisma.ProgramVersionGetPayload<{
  select: typeof IMPORT_VERSION_SELECT;
}>;

export async function assertCurriculumImport(
  client: Prisma.TransactionClient,
  access: AccessContext,
  version: ImportVersionRow,
): Promise<void> {
  if (version.status !== ProgramVersionStatus.DRAFT)
    throw new AppException(IMPORT_ERRORS.VERSION_NOT_DRAFT);
  const state = await programEditState(client, version.programId);
  assertDirectEdit(
    access,
    PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL,
    programTarget(version.program),
    state,
  );
  if (version.sourceRequestId !== null || version.correctionOfId !== null)
    throw new AppException(COMMON_ERRORS.CHANGE_REQUEST_REQUIRED);
}

export function programScope(access: AccessContext): Prisma.ProgramWhereInput {
  const scope = access.scopeFor(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL);
  return scope.all
    ? {}
    : {
        OR: [
          { id: { in: [...scope.programIds] } },
          { facultyId: { in: [...scope.orgUnitIds] } },
        ],
      };
}
export function visibleBatches(
  access: AccessContext,
): Prisma.ImportBatchWhereInput {
  const ordinary = { importType: { notIn: [...STUDENT_IMPORT_TYPES] } };
  const visible: Prisma.ImportBatchWhereInput[] = [
    { performedById: access.userId, ...ordinary },
  ];
  if (access.scopeFor(PERMISSIONS.DATA_IMPORT_EXCEL).all)
    visible.push({
      importType: {
        notIn: [ImportType.CURRICULUM, ...STUDENT_IMPORT_TYPES],
      },
    });
  if (holdsStudentImport(access))
    visible.push({ importType: { in: [...STUDENT_IMPORT_TYPES] } });
  if (access.has(PERMISSIONS.CURRICULUM_IMPORT_EXPORT_EXCEL))
    visible.push({
      importType: ImportType.CURRICULUM,
      program: programScope(access),
    });
  return { OR: visible };
}
