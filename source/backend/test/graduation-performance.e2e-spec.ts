import { performance } from 'node:perf_hooks';
import pg from 'pg';
import { GraduationBatchRunner } from '../src/features/graduation/graduation-batch.runner.js';
import { GraduationResultChangeScanner } from '../src/features/graduation/graduation-result-change.scanner.js';
import { GRADUATION_LIMITS } from '../src/shared/graduation/graduation.constants.js';
import { writeAcademicResultSource } from '../src/shared/students/academic-result.writer.js';
import { createCourse } from './fixtures/courses.js';
import { createSyntheticStudentFixture } from './fixtures/students.js';
import {
  GRADUATION_CSRF,
  confirmGraduationBatch,
  graduationHarness,
  pauseGraduation,
  resumeGraduation,
  seedGraduationFixture,
  waitForGraduationValue,
} from './fixtures/graduation.js';

describe.runIf(process.env.RUN_GRADUATION_PERFORMANCE === '1')(
  'graduation opt-in 500-student acceptance benchmark',
  () => {
    const harness = graduationHarness();
    const STUDENTS = GRADUATION_LIMITS.PERFORMANCE_STUDENTS;
    const BUDGET_MS = GRADUATION_LIMITS.PERFORMANCE_BUDGET_MS;

    it(
      'measures confirmation-to-terminal with multisemester retakes, groups and equivalence',
      async () => {
        await pauseGraduation(harness);
        const fixture = await seedGraduationFixture(
          harness.app,
          harness.office,
        );
        const substitute = await createCourse(harness.app, {
          courseCode: 'SYN-GRAD-PERF-OLD',
          credits: '3',
        });
        await harness.office
          .post('/api/equivalence-groups')
          .set(GRADUATION_CSRF)
          .send({
            groupCode: 'SYN-GRAD-PERF-EQ',
            courseIds: [fixture.courseIds.mandatory, substitute.id],
          })
          .expect(201);
        const students = [fixture.studentId, fixture.secondStudentId];
        for (let index = students.length; index < STUDENTS; index += 1) {
          students.push(
            (
              await createSyntheticStudentFixture(
                harness.app,
                `GRADPERF${index}`,
                fixture.world,
              )
            ).studentId,
          );
        }
        for (const [index, studentId] of students.entries()) {
          const courseId =
            index % 2 === 0 ? substitute.id : fixture.courseIds.mandatory;
          await harness.prisma.$transaction((tx) =>
            writeAcademicResultSource(
              tx,
              {
                rows: [
                  ...Object.values(fixture.courseIds)
                    .filter((id) => id !== fixture.courseIds.mandatory)
                    .map((id, rowIndex) => ({
                      rowNumber: rowIndex + 2,
                      action: 'CREATE' as const,
                      existingId: null,
                      expectedRevision: null,
                      value: {
                        studentId,
                        courseId: id,
                        semesterId: fixture.priorSemesterId,
                        status: 'PASSED' as const,
                        score4: '3',
                        score10: '8',
                        letterGrade: 'B',
                      },
                    })),
                  {
                    rowNumber: 5,
                    action: 'CREATE',
                    existingId: null,
                    expectedRevision: null,
                    value: {
                      studentId,
                      courseId,
                      semesterId: fixture.priorSemesterId,
                      status: index % 2 === 0 ? 'PASSED' : 'FAILED',
                      score4: index % 2 === 0 ? '3' : '1',
                      score10: index % 2 === 0 ? '8' : '2',
                      letterGrade: index % 2 === 0 ? 'B' : 'F',
                    },
                  },
                  {
                    rowNumber: 6,
                    action: 'CREATE',
                    existingId: null,
                    expectedRevision: null,
                    value: {
                      studentId,
                      courseId,
                      semesterId: fixture.semesterId,
                      status: 'FAILED',
                      score4: '4',
                      score10: '8',
                      letterGrade: 'F',
                    },
                  },
                ],
              },
              { source: 'EXCEL', actorId: harness.account.id },
            ),
          );
        }
        while (
          await harness.prisma.academicResultChange.count({
            where: { graduationReceipt: null },
          })
        ) {
          await harness.app.get(GraduationResultChangeScanner).scan();
        }
        await resumeGraduation(harness);
        let queryCount = 0;
        const originalQuery = pg.Client.prototype.query;
        pg.Client.prototype.query = function (
          this: pg.Client,
          ...args: unknown[]
        ) {
          queryCount += 1;
          return Reflect.apply(originalQuery, this, args);
        } as typeof originalQuery;
        let peakRssBytes = process.memoryUsage().rss;
        const memorySampler = setInterval(() => {
          peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
        }, 50);
        const progress: { processed: number; status: string }[] = [];
        const started = performance.now();
        try {
          const batch = await confirmGraduationBatch(
            harness,
            fixture,
            'performance-500',
          );
          expect(batch.preview).toMatchObject({
            studentCount: STUDENTS,
            enrollmentCount: STUDENTS,
          });
          const response = await waitForGraduationValue(
            async () => {
              const answer = await harness.office
                .get(`/api/graduation-batches/${batch.id}`)
                .expect(200);
              progress.push({
                processed: Number(answer.body.processedCount),
                status: String(answer.body.status),
              });
              return answer;
            },
            (answer) =>
              ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(
                answer.body.status,
              ),
            BUDGET_MS,
          );
          const elapsedMs = performance.now() - started;
          expect(response.body).toMatchObject({
            status: 'COMPLETED',
            processedCount: STUDENTS,
            eligibleCount: STUDENTS / 2,
            notEligibleCount: STUDENTS / 2,
            errorCount: 0,
          });
          expect(
            progress.some(
              (entry) => entry.processed > 0 && entry.processed < STUDENTS,
            ),
          ).toBe(true);
          expect(queryCount).toBeGreaterThan(0);
          const auditsBeforeRecovery =
            await harness.prisma.graduationAudit.count({
              where: { batchItem: { batchId: batch.id } },
            });
          await harness.app.get(GraduationBatchRunner).run(batch.id);
          await harness.app.get(GraduationBatchRunner).recover();
          expect(
            await harness.prisma.graduationAudit.count({
              where: { batchItem: { batchId: batch.id } },
            }),
          ).toBe(auditsBeforeRecovery);
          console.info(
            JSON.stringify({
              students: STUDENTS,
              elapsedMs,
              budgetMs: BUDGET_MS,
              queryCount,
              peakRssBytes,
              progress,
              counts: {
                processed: response.body.processedCount,
                eligible: response.body.eligibleCount,
                notEligible: response.body.notEligibleCount,
                error: response.body.errorCount,
              },
              environment: {
                node: process.version,
                platform: process.platform,
                architecture: process.arch,
                postgres: '18',
                redis: '8',
                timing:
                  'preview-and-confirmation-through-terminal; fixture seeding excluded',
                queries:
                  'all pg Client queries in this isolated spec during the timed window',
              },
            }),
          );
          expect(elapsedMs).toBeLessThan(BUDGET_MS);
        } finally {
          clearInterval(memorySampler);
          pg.Client.prototype.query = originalQuery;
        }
      },
      BUDGET_MS * 4,
    );
  },
);
