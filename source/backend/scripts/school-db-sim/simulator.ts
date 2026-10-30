// Builds the synthetic school database used by the F-22 simulator and its tests.
// Synthetic only: every name and code is generated here, nothing is read from the school data dump.
import sql from 'mssql';

export const SIM = {
  DATABASE: 'CMS_SYNC_SIM',
  READER: 'cms_sync_reader',
} as const;

export interface SimReferenceCodes {
  cohortCode: string;
  programCode: string;
  admissionSemesterCode: string;
  courseCode: string;
}

export interface SimStudent {
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
export interface SimResult {
  sourceId: string;
  studentCode: string;
  courseCode: string;
  semesterCode: string;
  score10: string | null;
  score4: string | null;
  letterGrade: string | null;
  status: string;
}
export interface SimClass {
  sourceId: string;
  classCode: string;
  courseCode: string;
  semesterCode: string;
}

export function syntheticRows(codes: SimReferenceCodes, count: number, prefix = 'SIM') {
  const students: SimStudent[] = [];
  const results: SimResult[] = [];
  for (let index = 1; index <= count; index++) {
    const studentCode = `${prefix}${String(index).padStart(5, '0')}`;
    students.push({
      sourceId: `S-${studentCode}`,
      studentCode,
      fullName: `Sinh viên mô phỏng ${index}`,
      cohortCode: codes.cohortCode,
      major: 'SIM',
      programCode: codes.programCode,
      admissionSemesterCode: codes.admissionSemesterCode,
      statusSemesterCode: codes.admissionSemesterCode,
      status: 'STUDYING',
    });
    results.push({
      sourceId: `R-${studentCode}`,
      studentCode,
      courseCode: codes.courseCode,
      semesterCode: codes.admissionSemesterCode,
      score10: '8.00',
      score4: '3.50',
      letterGrade: 'B+',
      status: 'PASSED',
    });
  }
  const classes: SimClass[] = [
    {
      sourceId: `C-${prefix}-1`,
      classCode: `${codes.courseCode}.01`,
      courseCode: codes.courseCode,
      semesterCode: codes.admissionSemesterCode,
    },
  ];
  return { students, results, classes };
}

const SCHEMA_SQL = [
  `IF SCHEMA_ID('sim') IS NULL EXEC('CREATE SCHEMA sim')`,
  `IF SCHEMA_ID('cms_sync_v1') IS NULL EXEC('CREATE SCHEMA cms_sync_v1')`,
  `IF OBJECT_ID('sim.snapshot_info') IS NULL CREATE TABLE sim.snapshot_info (snapshot_version nvarchar(64) NOT NULL)`,
  `IF OBJECT_ID('sim.students') IS NULL CREATE TABLE sim.students (
     source_id nvarchar(64) PRIMARY KEY, student_code nvarchar(32) NOT NULL, full_name nvarchar(200) NOT NULL,
     cohort_code nvarchar(60) NOT NULL, major nvarchar(60) NOT NULL, program_code nvarchar(60) NOT NULL,
     admission_semester_code nvarchar(60) NOT NULL, status_semester_code nvarchar(60) NOT NULL, status nvarchar(20) NOT NULL)`,
  `IF OBJECT_ID('sim.academic_results') IS NULL CREATE TABLE sim.academic_results (
     source_id nvarchar(64) PRIMARY KEY, student_code nvarchar(32) NOT NULL, course_code nvarchar(60) NOT NULL,
     semester_code nvarchar(60) NOT NULL, score10 decimal(4,2) NULL, score4 decimal(3,2) NULL,
     letter_grade nvarchar(4) NULL, status nvarchar(20) NOT NULL)`,
  `IF OBJECT_ID('sim.classes') IS NULL CREATE TABLE sim.classes (
     source_id nvarchar(64) PRIMARY KEY, class_code nvarchar(60) NOT NULL, course_code nvarchar(60) NOT NULL,
     semester_code nvarchar(60) NOT NULL)`,
  `CREATE OR ALTER VIEW cms_sync_v1.snapshot_info AS SELECT snapshot_version FROM sim.snapshot_info`,
  `CREATE OR ALTER VIEW cms_sync_v1.students AS SELECT * FROM sim.students`,
  `CREATE OR ALTER VIEW cms_sync_v1.academic_results AS SELECT * FROM sim.academic_results`,
  `CREATE OR ALTER VIEW cms_sync_v1.classes AS SELECT * FROM sim.classes`,
];

export interface SimServer {
  host: string;
  port: number;
  saPassword: string;
}

async function connect(server: SimServer, database: string): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool({
    server: server.host,
    port: server.port,
    database,
    user: 'sa',
    password: server.saPassword,
    options: { encrypt: true, trustServerCertificate: true },
  }).connect();
}

// Creates the database, the fixed views and a login that can read those views and nothing else.
export async function createSimulator(server: SimServer, readerPassword: string): Promise<void> {
  const master = await connect(server, 'master');
  try {
    await master.request().query(`IF DB_ID('${SIM.DATABASE}') IS NULL CREATE DATABASE ${SIM.DATABASE}`);
    await master.request().query(`ALTER DATABASE ${SIM.DATABASE} SET ALLOW_SNAPSHOT_ISOLATION ON`);
    const login = await master.request().query(`SELECT 1 AS found FROM sys.server_principals WHERE name = '${SIM.READER}'`);
    const escaped = readerPassword.replace(/'/g, "''");
    await master.request().query(
      login.recordset.length > 0
        ? `ALTER LOGIN ${SIM.READER} WITH PASSWORD = '${escaped}'`
        : `CREATE LOGIN ${SIM.READER} WITH PASSWORD = '${escaped}', CHECK_POLICY = OFF`,
    );
  } finally {
    await master.close();
  }
  const db = await connect(server, SIM.DATABASE);
  try {
    for (const statement of SCHEMA_SQL) await db.request().query(statement);
    await db.request().query(
      `IF USER_ID('${SIM.READER}') IS NULL CREATE USER ${SIM.READER} FOR LOGIN ${SIM.READER}`,
    );
    await db.request().query(`GRANT SELECT ON SCHEMA::cms_sync_v1 TO ${SIM.READER}`);
  } finally {
    await db.close();
  }
}

// Replaces the whole synthetic snapshot in one transaction.
export async function loadSnapshot(
  server: SimServer,
  version: string,
  rows: { students: SimStudent[]; results: SimResult[]; classes: SimClass[] },
): Promise<void> {
  const db = await connect(server, SIM.DATABASE);
  const tx = new sql.Transaction(db);
  try {
    await tx.begin();
    for (const table of ['academic_results', 'classes', 'students', 'snapshot_info']) {
      await new sql.Request(tx).query(`DELETE FROM sim.${table}`);
    }
    await new sql.Request(tx)
      .input('version', sql.NVarChar, version)
      .query('INSERT INTO sim.snapshot_info (snapshot_version) VALUES (@version)');
    const bulk = async (name: string, columns: [string, sql.ISqlType | (() => sql.ISqlType), boolean][], data: unknown[][]) => {
      if (data.length === 0) return;
      const table = new sql.Table(`sim.${name}`);
      for (const [column, type, nullable] of columns) table.columns.add(column, type, { nullable });
      for (const row of data) table.rows.add(...(row as (string | null)[]));
      await new sql.Request(tx).bulk(table);
    };
    await bulk(
      'students',
      [
        ['source_id', sql.NVarChar(64), false], ['student_code', sql.NVarChar(32), false],
        ['full_name', sql.NVarChar(200), false], ['cohort_code', sql.NVarChar(60), false],
        ['major', sql.NVarChar(60), false], ['program_code', sql.NVarChar(60), false],
        ['admission_semester_code', sql.NVarChar(60), false], ['status_semester_code', sql.NVarChar(60), false],
        ['status', sql.NVarChar(20), false],
      ],
      rows.students.map((s) => [s.sourceId, s.studentCode, s.fullName, s.cohortCode, s.major, s.programCode, s.admissionSemesterCode, s.statusSemesterCode, s.status]),
    );
    await bulk(
      'academic_results',
      [
        ['source_id', sql.NVarChar(64), false], ['student_code', sql.NVarChar(32), false],
        ['course_code', sql.NVarChar(60), false], ['semester_code', sql.NVarChar(60), false],
        ['score10', sql.Decimal(4, 2), true], ['score4', sql.Decimal(3, 2), true],
        ['letter_grade', sql.NVarChar(4), true], ['status', sql.NVarChar(20), false],
      ],
      rows.results.map((r) => [r.sourceId, r.studentCode, r.courseCode, r.semesterCode, r.score10, r.score4, r.letterGrade, r.status]),
    );
    await bulk(
      'classes',
      [
        ['source_id', sql.NVarChar(64), false], ['class_code', sql.NVarChar(60), false],
        ['course_code', sql.NVarChar(60), false], ['semester_code', sql.NVarChar(60), false],
      ],
      rows.classes.map((c) => [c.sourceId, c.classCode, c.courseCode, c.semesterCode]),
    );
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => undefined);
    throw error;
  } finally {
    await db.close();
  }
}
