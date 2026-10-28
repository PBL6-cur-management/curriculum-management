import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { lockStudents } from './student-locks.js';
import type {
  AcademicResultPlanRow,
  AcademicResultImportPlan,
  AcademicResultValue,
  AcademicResultWriteOutcome,
  SourceWriteContext,
} from './student-import.types.js';
import { assertWriteContext } from './student-source.writer.js';
import { STUDENT_ERRORS } from './student.errors.js';

interface StoredResult {
  id: string;
  revision: number;
  score10: Prisma.Decimal | null;
  score4: Prisma.Decimal | null;
  letterGrade: string | null;
  status: AcademicResultValue['status'];
  dataSource: SourceWriteContext['source'];
}

const tripleKey = (studentId: string, courseId: string, semesterId: string) =>
  `${studentId}|${courseId}|${semesterId}`;

const sameDecimal = (stored: Prisma.Decimal | null, supplied: string | null) =>
  stored === null || supplied === null
    ? stored === null && supplied === null
    : stored.equals(new Prisma.Decimal(supplied));

function sameValue(stored: StoredResult, value: AcademicResultValue): boolean {
  return (
    sameDecimal(stored.score10, value.score10) &&
    sameDecimal(stored.score4, value.score4) &&
    stored.letterGrade === value.letterGrade &&
    stored.status === value.status
  );
}

// The change feed stores full snapshots with decimals as strings, so a reader never needs the live row to know what an attempt looked like.
function snapshot(
  value: Pick<
    AcademicResultValue,
    'score10' | 'score4' | 'letterGrade' | 'status'
  >,
  dataSource: string,
): Prisma.InputJsonObject {
  return {
    score10: value.score10,
    score4: value.score4,
    letterGrade: value.letterGrade,
    status: value.status,
    dataSource,
  };
}

const storedSnapshot = (stored: StoredResult) =>
  snapshot(
    {
      score10: stored.score10?.toString() ?? null,
      score4: stored.score4?.toString() ?? null,
      letterGrade: stored.letterGrade,
      status: stored.status,
    },
    stored.dataSource,
  );

// All-or-nothing: a stale revision or a vanished row throws, and the caller's transaction rolls the whole file back.
export async function writeAcademicResultSource(
  tx: Prisma.TransactionClient,
  plan: AcademicResultImportPlan,
  context: SourceWriteContext,
): Promise<AcademicResultWriteOutcome> {
  assertWriteContext(context);
  const outcome: AcademicResultWriteOutcome = {
    created: 0,
    updated: 0,
    unchanged: 0,
    sourcePreserved: 0,
  };
  const rows = [...plan.rows].sort((a, b) => a.rowNumber - b.rowNumber);
  const studentIds = [...new Set(rows.map((row) => row.value.studentId))];
  await lockStudents(tx, studentIds);

  const stored = await tx.academicResult.findMany({
    where: { studentId: { in: studentIds } },
    select: {
      id: true,
      studentId: true,
      courseId: true,
      semesterId: true,
      revision: true,
      score10: true,
      score4: true,
      letterGrade: true,
      status: true,
      dataSource: true,
    },
  });
  const byTriple = new Map(
    stored.map((row) => [
      tripleKey(row.studentId, row.courseId, row.semesterId),
      row,
    ]),
  );

  for (const row of rows) {
    if (row.action === 'PRESERVE_SOURCE') {
      outcome.sourcePreserved++;
      continue;
    }
    const { value } = row;
    const fresh = byTriple.get(
      tripleKey(value.studentId, value.courseId, value.semesterId),
    );
    await writeRow(tx, row, fresh, context, outcome);
  }
  return outcome;
}

async function writeRow(
  tx: Prisma.TransactionClient,
  row: AcademicResultPlanRow,
  fresh: StoredResult | undefined,
  context: SourceWriteContext,
  outcome: AcademicResultWriteOutcome,
): Promise<void> {
  const { value } = row;
  if (!fresh) {
    if (row.existingId !== null) {
      throw new AppException(STUDENT_ERRORS.ENROLLMENT_STATE_CHANGED);
    }
    const created = await tx.academicResult.create({
      data: {
        studentId: value.studentId,
        courseId: value.courseId,
        semesterId: value.semesterId,
        score10: value.score10,
        score4: value.score4,
        letterGrade: value.letterGrade,
        status: value.status,
        dataSource: context.source,
        revision: 1,
      },
      select: { id: true },
    });
    await tx.academicResultChange.create({
      data: {
        academicResultId: created.id,
        revision: 1,
        before: Prisma.JsonNull,
        after: snapshot(value, context.source),
      },
    });
    outcome.created++;
    return;
  }

  if (row.existingId !== fresh.id || row.expectedRevision !== fresh.revision) {
    throw new AppException(STUDENT_ERRORS.ENROLLMENT_STATE_CHANGED);
  }
  if (fresh.dataSource === 'SCHOOL_DB' && context.source === 'EXCEL') {
    outcome.sourcePreserved++;
    return;
  }
  if (sameValue(fresh, value) && fresh.dataSource === context.source) {
    outcome.unchanged++;
    return;
  }
  const revision = fresh.revision + 1;
  await tx.academicResult.update({
    where: { id: fresh.id },
    data: {
      score10: value.score10,
      score4: value.score4,
      letterGrade: value.letterGrade,
      status: value.status,
      dataSource: context.source,
      revision,
    },
  });
  await tx.academicResultChange.create({
    data: {
      academicResultId: fresh.id,
      revision,
      before: storedSnapshot(fresh),
      after: snapshot(value, context.source),
    },
  });
  outcome.updated++;
}
