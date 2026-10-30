// pnpm school-db:sim:seed -- --cohort K2026 --program 7480201 --semester 2026-2027-1 --course 1020010 [--count 20]
// Fills the running simulator (pnpm school-db:sim:start) with synthetic students for the given LOCAL codes.
// Passwords come from SCHOOL_DB_SIM_SA_PASSWORD / SCHOOL_DB_SIM_READER_PASSWORD and are never printed.
import 'dotenv/config';
import { parseArgs } from 'node:util';
import { SIM, createSimulator, loadSnapshot, syntheticRows } from './simulator.js';

const { values } = parseArgs({
  options: {
    cohort: { type: 'string' },
    program: { type: 'string' },
    semester: { type: 'string' },
    course: { type: 'string' },
    count: { type: 'string', default: '20' },
  },
});

const saPassword = process.env.SCHOOL_DB_SIM_SA_PASSWORD;
const readerPassword = process.env.SCHOOL_DB_SIM_READER_PASSWORD;
if (!saPassword || !readerPassword) {
  throw new Error('Set SCHOOL_DB_SIM_SA_PASSWORD and SCHOOL_DB_SIM_READER_PASSWORD in .env');
}
if (!values.cohort || !values.program || !values.semester || !values.course) {
  throw new Error('Pass --cohort, --program, --semester and --course (local codes)');
}

const server = {
  host: '127.0.0.1',
  port: Number(process.env.SCHOOL_DB_SIM_PORT ?? 14330),
  saPassword,
};
await createSimulator(server, readerPassword);
const rows = syntheticRows(
  {
    cohortCode: values.cohort,
    programCode: values.program,
    admissionSemesterCode: values.semester,
    courseCode: values.course,
  },
  Number(values.count),
);
await loadSnapshot(server, `sim-${new Date().toISOString()}`, rows);
console.log(
  `Simulator ready: database ${SIM.DATABASE}, reader ${SIM.READER}, ${rows.students.length} students, ${rows.results.length} results, ${rows.classes.length} classes.`,
);
