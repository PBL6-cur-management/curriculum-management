import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  TARGET_PROGRAM_CODES,
  getTrackDefinition,
  parseTrackAssignments,
  type TrackAssignment,
} from './seed-data/dut/extract/parse-track-notes.js';

const TX_TIMEOUT_MS = 60_000;
const COMMON = 'COMMON';

interface Counters {
  tracksCreated: number;
  itemsMoved: number;
  itemsCloned: number;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const itemInclude = {
  course: { select: { credits: true } },
  ploMappings: { include: { cloLinks: true } },
  requisites: true,
} satisfies Prisma.CurriculumItemInclude;

type ItemWithRelations = Prisma.CurriculumItemGetPayload<{
  include: typeof itemInclude;
}>;

interface MatchedItem {
  item: ItemWithRelations;
  assignments: TrackAssignment[];
}

function keyOf(trackId: string | null, courseId: string): string {
  return `${trackId ?? COMMON}:${courseId}`;
}

async function processVersion(
  programCode: string,
  versionId: string,
): Promise<Counters> {
  const counters: Counters = { tracksCreated: 0, itemsMoved: 0, itemsCloned: 0 };

  const items = await prisma.curriculumItem.findMany({
    where: { versionId },
    include: itemInclude,
  });
  const existingTracks = await prisma.programTrack.findMany({
    where: { versionId },
    select: { id: true, trackCode: true },
  });
  const groups = await prisma.electiveGroup.findMany({
    where: { versionId },
    select: { id: true, trackId: true },
  });
  const groupTrack = new Map(groups.map((g) => [g.id, g.trackId]));
  const knownTrackCodes = new Set(existingTracks.map((t) => t.trackCode));

  const existingKeys = new Set(items.map((i) => keyOf(i.trackId, i.courseId)));
  const maxSort = new Map<number, number>();
  for (const i of items) {
    maxSort.set(
      i.plannedSemester,
      Math.max(maxSort.get(i.plannedSemester) ?? 0, i.sortOrder),
    );
  }
  const nextSortOrder = (semester: number): number => {
    const next = (maxSort.get(semester) ?? 0) + 1;
    maxSort.set(semester, next);
    return next;
  };

  const matched: MatchedItem[] = [];
  for (const item of items) {
    if (item.trackId !== null || !item.note || item.note.trim() === '') {
      continue;
    }
    const assignments = parseTrackAssignments(
      programCode,
      item.note,
      item.isElective,
    );
    if (assignments.length > 0) {
      matched.push({ item, assignments });
    }
  }
  if (matched.length === 0) {
    return counters;
  }

  await prisma.$transaction(
    async (tx) => {
      const trackIds = new Map<string, string>();
      const codes = new Set(
        matched.flatMap((m) => m.assignments.map((a) => a.trackCode)),
      );
      for (const trackCode of codes) {
        const def = getTrackDefinition(programCode, trackCode);
        if (!def) {
          throw new Error(`No track definition ${programCode}/${trackCode}`);
        }
        const track = await tx.programTrack.upsert({
          where: { versionId_trackCode: { versionId, trackCode } },
          create: {
            versionId,
            trackCode,
            trackName: def.trackName,
            englishName: def.englishName,
            description: def.description,
            sortOrder: def.sortOrder,
          },
          update: {},
          select: { id: true },
        });
        trackIds.set(trackCode, track.id);
        if (!knownTrackCodes.has(trackCode)) {
          counters.tracksCreated += 1;
        }
      }

      for (const { item, assignments } of matched) {
        const [first, ...rest] = assignments;
        if (!first) continue;
        const firstTrackId = trackIds.get(first.trackCode);
        if (!firstTrackId) continue;

        if (!existingKeys.has(keyOf(firstTrackId, item.courseId))) {
          const clearGroup =
            item.electiveGroupId !== null &&
            (!first.isElective ||
              groupTrack.get(item.electiveGroupId) !== firstTrackId);
          await tx.curriculumItem.update({
            where: { id: item.id },
            data: {
              trackId: firstTrackId,
              isElective: first.isElective,
              ...(clearGroup ? { electiveGroupId: null } : {}),
            },
          });
          existingKeys.delete(keyOf(null, item.courseId));
          existingKeys.add(keyOf(firstTrackId, item.courseId));
          counters.itemsMoved += 1;
        }

        for (const extra of rest) {
          const extraTrackId = trackIds.get(extra.trackCode);
          if (!extraTrackId) continue;
          const key = keyOf(extraTrackId, item.courseId);
          if (existingKeys.has(key)) continue;

          const clone = await tx.curriculumItem.create({
            data: {
              versionId,
              trackId: extraTrackId,
              plannedSemester: item.plannedSemester,
              sortOrder: nextSortOrder(item.plannedSemester),
              courseId: item.courseId,
              blockSymbol: item.blockSymbol,
              isElective: extra.isElective,
              electiveGroupId: null,
              htDa: item.htDa,
              tqDa: item.tqDa,
              minStudiedScore: item.minStudiedScore,
              minTransferScore: item.minTransferScore,
              note: item.note,
              courseNameSnapshot: item.courseNameSnapshot,
              creditsSnapshot: item.creditsSnapshot,
            },
            select: { id: true },
          });
          if (item.requisites.length > 0) {
            await tx.curriculumRequisite.createMany({
              data: item.requisites.map((r) => ({
                itemId: clone.id,
                sourceCourseId: r.sourceCourseId,
                relationType: r.relationType,
                minScore: r.minScore,
              })),
              skipDuplicates: true,
            });
          }
          if (item.ploMappings.length > 0) {
            await tx.coursePLOMapping.createMany({
              data: item.ploMappings.map((m) => ({
                curriculumItemId: clone.id,
                ploId: m.ploId,
                weight: m.weight,
              })),
              skipDuplicates: true,
            });
            const cloLinks = item.ploMappings.flatMap((m) =>
              m.cloLinks.map((l) => ({
                curriculumItemId: clone.id,
                ploId: l.ploId,
                cloId: l.cloId,
              })),
            );
            if (cloLinks.length > 0) {
              await tx.cLOPLOMapping.createMany({
                data: cloLinks,
                skipDuplicates: true,
              });
            }
          }
          existingKeys.add(key);
          counters.itemsCloned += 1;
        }
      }

      const tracks = await tx.programTrack.findMany({
        where: { versionId },
        select: {
          id: true,
          curriculumItems: {
            select: { isElective: true, course: { select: { credits: true } } },
          },
        },
      });
      for (const track of tracks) {
        let compulsory = new Prisma.Decimal(0);
        let elective = new Prisma.Decimal(0);
        for (const ci of track.curriculumItems) {
          if (ci.isElective) {
            elective = elective.plus(ci.course.credits);
          } else {
            compulsory = compulsory.plus(ci.course.credits);
          }
        }
        await tx.programTrack.update({
          where: { id: track.id },
          data: { compulsoryCredits: compulsory, electiveCredits: elective },
        });
      }
    },
    { timeout: TX_TIMEOUT_MS },
  );

  return counters;
}

async function main(): Promise<void> {
  const programs = await prisma.program.findMany({
    where: { programCode: { in: [...TARGET_PROGRAM_CODES] } },
    include: {
      versions: { where: { sourceRequestId: null }, select: { id: true } },
    },
    orderBy: { programCode: 'asc' },
  });

  const total: Counters = { tracksCreated: 0, itemsMoved: 0, itemsCloned: 0 };
  for (const program of programs) {
    const sum: Counters = { tracksCreated: 0, itemsMoved: 0, itemsCloned: 0 };
    for (const version of program.versions) {
      const c = await processVersion(program.programCode, version.id);
      sum.tracksCreated += c.tracksCreated;
      sum.itemsMoved += c.itemsMoved;
      sum.itemsCloned += c.itemsCloned;
    }
    console.log(
      `${program.programCode}: versions=${program.versions.length} tracksCreated=${sum.tracksCreated} itemsMoved=${sum.itemsMoved} itemsCloned=${sum.itemsCloned}`,
    );
    total.tracksCreated += sum.tracksCreated;
    total.itemsMoved += sum.itemsMoved;
    total.itemsCloned += sum.itemsCloned;
  }
  console.log(
    `TOTAL: programs=${programs.length} tracksCreated=${total.tracksCreated} itemsMoved=${total.itemsMoved} itemsCloned=${total.itemsCloned}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
