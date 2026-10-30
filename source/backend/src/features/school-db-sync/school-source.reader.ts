import { Injectable } from '@nestjs/common';
import sql from 'mssql';
import {
  SCHOOL_SOURCE_SCHEMA,
  SCHOOL_SYNC_LIMITS,
} from './school-sync.constants.js';
import { SyncFailure, type SyncFailureCode } from './school-sync.errors.js';

export interface SchoolConnection {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

// The fixed cms_sync_v1 contract (D3). Status columns hold the CMS tokens, not free text.
export interface SourceStudentRow {
  sourceId: string;
  studentCode: string;
  fullName: string;
  cohortCode: string;
  major: string;
  programCode: string;
  admissionSemesterCode: string;
  statusSemesterCode: string;
  status: string;
}
export interface SourceResultRow {
  sourceId: string;
  studentCode: string;
  courseCode: string;
  semesterCode: string;
  score10: string | null;
  score4: string | null;
  letterGrade: string | null;
  status: string;
}
export interface SourceClassRow {
  sourceId: string;
  classCode: string;
  courseCode: string;
  semesterCode: string;
}
export interface SchoolSnapshot {
  version: string;
  students: SourceStudentRow[];
  results: SourceResultRow[];
  classes: SourceClassRow[];
}

export type ProbeOutcome = 'CONNECTED' | SyncFailureCode;

// Abstract so tests can stand in for the school without a SQL Server.
export abstract class SchoolSourceReader {
  abstract probe(connection: SchoolConnection): Promise<ProbeOutcome>;
  // Reads the whole snapshot before anything local is written (D7). Throws SyncFailure.
  abstract read(connection: SchoolConnection): Promise<SchoolSnapshot>;
}

const VIEWS = {
  SNAPSHOT: `${SCHOOL_SOURCE_SCHEMA}.snapshot_info`,
  STUDENTS: `${SCHOOL_SOURCE_SCHEMA}.students`,
  RESULTS: `${SCHOOL_SOURCE_SCHEMA}.academic_results`,
  CLASSES: `${SCHOOL_SOURCE_SCHEMA}.classes`,
} as const;

// Any write or ownership right on the source database fails the probe: the connector must be unable to change it.
const WRITE_RIGHTS_SQL = `SELECT
  CAST(ISNULL(IS_SRVROLEMEMBER('sysadmin'), 0) AS int)
  + CAST(ISNULL(IS_ROLEMEMBER('db_owner'), 0) AS int)
  + CAST(ISNULL(IS_ROLEMEMBER('db_datawriter'), 0) AS int)
  + CAST(ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'INSERT'), 0) AS int)
  + CAST(ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'UPDATE'), 0) AS int)
  + CAST(ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'DELETE'), 0) AS int)
  + CAST(ISNULL(HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'ALTER'), 0) AS int) AS rights`;

const text = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
    ? String(value).trim()
    : '';
const decimalText = (value: unknown): string | null =>
  value === null || value === undefined ? null : Number(value).toFixed(2);
const optionalText = (value: unknown): string | null => text(value) || null;

@Injectable()
export class MssqlSchoolSourceReader extends SchoolSourceReader {
  private async connect(connection: SchoolConnection): Promise<sql.ConnectionPool> {
    const pool = new sql.ConnectionPool({
      server: connection.host,
      port: connection.port,
      database: connection.database,
      user: connection.username,
      password: connection.password,
      connectionTimeout: SCHOOL_SYNC_LIMITS.CONNECT_TIMEOUT_MS,
      requestTimeout: SCHOOL_SYNC_LIMITS.REQUEST_TIMEOUT_MS,
      pool: { max: 1, min: 0 },
      options: { encrypt: true, trustServerCertificate: true },
    });
    try {
      await pool.connect();
      return pool;
    } catch {
      throw new SyncFailure('CONNECTION_FAILED');
    }
  }

  async probe(connection: SchoolConnection): Promise<ProbeOutcome> {
    let pool: sql.ConnectionPool | null = null;
    try {
      pool = await this.connect(connection);
      const rights = await pool.request().query<{ rights: number }>(WRITE_RIGHTS_SQL);
      if ((rights.recordset[0]?.rights ?? 1) > 0) return 'READ_ONLY_REQUIRED';
      for (const view of Object.values(VIEWS)) {
        await pool.request().query(`SELECT TOP 0 * FROM ${view}`);
      }
      return 'CONNECTED';
    } catch (error) {
      if (error instanceof SyncFailure) return error.failure;
      return 'SOURCE_CONTRACT_INVALID';
    } finally {
      await pool?.close().catch(() => undefined);
    }
  }

  async read(connection: SchoolConnection): Promise<SchoolSnapshot> {
    const pool = await this.connect(connection);
    // SNAPSHOT isolation: the four views are read as of one instant, so students and results agree.
    const transaction = new sql.Transaction(pool);
    try {
      try {
        await transaction.begin(sql.ISOLATION_LEVEL.SNAPSHOT);
      } catch {
        throw new SyncFailure('SOURCE_CONTRACT_INVALID', 'Nguồn cần bật SNAPSHOT isolation.');
      }
      const query = <T>(statement: string) =>
        new sql.Request(transaction).query<T>(statement).catch(() => {
          throw new SyncFailure('SOURCE_CONTRACT_INVALID');
        });
      const counts = await query<{ students: number; results: number; classes: number }>(
        `SELECT (SELECT COUNT_BIG(*) FROM ${VIEWS.STUDENTS}) AS students,
                (SELECT COUNT_BIG(*) FROM ${VIEWS.RESULTS}) AS results,
                (SELECT COUNT_BIG(*) FROM ${VIEWS.CLASSES}) AS classes`,
      );
      const count = counts.recordset[0]!;
      if (
        Number(count.students) > SCHOOL_SYNC_LIMITS.MAX_STUDENTS ||
        Number(count.results) > SCHOOL_SYNC_LIMITS.MAX_RESULTS ||
        Number(count.classes) > SCHOOL_SYNC_LIMITS.MAX_CLASSES
      ) {
        throw new SyncFailure('SOURCE_TOO_LARGE');
      }
      const version = await query<{ snapshot_version: unknown }>(
        `SELECT TOP 1 snapshot_version FROM ${VIEWS.SNAPSHOT}`,
      );
      const students = await query<Record<string, unknown>>(
        `SELECT source_id, student_code, full_name, cohort_code, major, program_code,
                admission_semester_code, status_semester_code, status
           FROM ${VIEWS.STUDENTS} ORDER BY source_id`,
      );
      const results = await query<Record<string, unknown>>(
        `SELECT source_id, student_code, course_code, semester_code, score10, score4,
                letter_grade, status
           FROM ${VIEWS.RESULTS} ORDER BY source_id`,
      );
      const classes = await query<Record<string, unknown>>(
        `SELECT source_id, class_code, course_code, semester_code
           FROM ${VIEWS.CLASSES} ORDER BY source_id`,
      );
      await transaction.commit();
      return {
        version: text(version.recordset[0]?.snapshot_version) || 'unversioned',
        students: students.recordset.map((row) => ({
          sourceId: text(row.source_id),
          studentCode: text(row.student_code),
          fullName: text(row.full_name),
          cohortCode: text(row.cohort_code),
          major: text(row.major),
          programCode: text(row.program_code),
          admissionSemesterCode: text(row.admission_semester_code),
          statusSemesterCode: text(row.status_semester_code),
          status: text(row.status),
        })),
        results: results.recordset.map((row) => ({
          sourceId: text(row.source_id),
          studentCode: text(row.student_code),
          courseCode: text(row.course_code),
          semesterCode: text(row.semester_code),
          score10: decimalText(row.score10),
          score4: decimalText(row.score4),
          letterGrade: optionalText(row.letter_grade),
          status: text(row.status),
        })),
        classes: classes.recordset.map((row) => ({
          sourceId: text(row.source_id),
          classCode: text(row.class_code),
          courseCode: text(row.course_code),
          semesterCode: text(row.semester_code),
        })),
      };
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      if (error instanceof SyncFailure) throw error;
      throw new SyncFailure('CONNECTION_FAILED');
    } finally {
      await pool.close().catch(() => undefined);
    }
  }
}
