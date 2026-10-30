import { Prisma } from '../../generated/prisma/client.js';
import { AppException } from '../exception/app.exception.js';
import { GRADUATION_LIMITS } from './graduation.constants.js';
import { GRADUATION_ERRORS } from './graduation.errors.js';

const SQLSTATE_MESSAGES: Readonly<Record<string, string>> = {
  '40001': 'Transaction serialization conflict.',
  '40P01': 'Transaction deadlock.',
  '23505': 'Unique constraint violation.',
  '23503': 'Foreign key constraint violation.',
  '23514': 'Check constraint violation.',
  '55P03': 'Database lock unavailable.',
  '57014': 'Database query cancelled.',
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function graduationSqlState(error: unknown): string | undefined {
  const value = record(error);
  const metadata = record(value?.meta);
  const cause =
    record(record(metadata?.driverAdapterError)?.cause) ?? record(value?.cause);
  const code =
    metadata?.code ??
    cause?.originalCode ??
    cause?.code ??
    (error instanceof Prisma.PrismaClientKnownRequestError
      ? undefined
      : value?.code);
  return typeof code === 'string' &&
    /^[0-9A-Z]{5}$/.test(code) &&
    !/^P\d{4}$/.test(code)
    ? code
    : undefined;
}

export function isGraduationTransactionConflict(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034') ||
    ['40001', '40P01'].includes(graduationSqlState(error) ?? '')
  );
}

export async function retryGraduationConflicts<T>(
  work: () => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (
        !isGraduationTransactionConflict(error) ||
        attempt >= GRADUATION_LIMITS.TRANSACTION_RETRIES
      )
        throw error;
    }
  }
}

export function graduationExecutionError(error: unknown): string {
  if (error instanceof AppException) {
    const definition = Object.values(GRADUATION_ERRORS).find(
      (entry) => entry.code === error.code,
    );
    return `name=AppException code=${definition?.code ?? 'UNKNOWN'} message=${definition?.message ?? 'Domain error; private details omitted.'}`;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const sqlState = graduationSqlState(error);
    const message = sqlState ? SQLSTATE_MESSAGES[sqlState] : undefined;
    return `name=PrismaClientKnownRequestError code=${/^P\d{4}$/.test(error.code) ? error.code : 'UNKNOWN'} sqlState=${sqlState ?? 'UNKNOWN'} message=${message ?? (error.code === 'P2034' ? SQLSTATE_MESSAGES['40001'] : 'Database operation failed; query details omitted.')}`;
  }
  const name =
    error instanceof Error &&
    [
      'Error',
      'TypeError',
      'RangeError',
      'PrismaClientValidationError',
      'PrismaClientUnknownRequestError',
      'PrismaClientInitializationError',
      'PrismaClientRustPanicError',
      'DriverAdapterError',
    ].includes(error.name)
      ? error.name
      : 'Error';
  const sqlState = graduationSqlState(error);
  if (sqlState)
    return `name=${name} code=DATABASE_ERROR sqlState=${sqlState} message=${SQLSTATE_MESSAGES[sqlState] ?? 'Database operation failed; query details omitted.'}`;
  return `name=${name} code=UNCLASSIFIED_EXECUTION message=Unexpected execution error; private details omitted.`;
}
