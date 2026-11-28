import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  groupRequiredCredits,
  programCredits,
} from '../src/shared/curriculum/program-credits.js';
import { rowCredits } from '../src/shared/curriculum/row-course.js';
import {
  TARGET_PROGRAM_CODES,
  getTrackDefinition,
  parseTrackAssignments,
  type TrackAssignment,
} from './seed-data/dut/extract/parse-track-notes.js';

const TX_TIMEOUT_MS = 60_000;
const COMMON = 'COMMON';
const ZERO = new Prisma.Decimal(0);
const COMPULSORY_RE = /\bbat\s+buoc\b/;
const CHOOSE_TC_RE = /(?<![a-z0-9])chon\s+(\d+(?:\.\d+)?)\s*tc(?![a-z0-9])/g;

interface Counters {
  tracksCreated: number;
  itemsMoved: number;
  itemsCloned: number;
  itemsNormalized: number;
  emptyGroupsRemoved: number;
  trackGroupsUpserted: number;
  electivesAssigned: number;
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

function normalizeVietnamese(input: string): string {
  return input
    .replaceAll(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractChooseCreditsFromNotes(
  notes: readonly (string | null)[],
): Prisma.Decimal | null {
  for (const note of notes) {
    if (!note) continue;
    const normalized = normalizeVietnamese(note);
    const matches = [...normalized.matchAll(CHOOSE_TC_RE)];
    if (matches.length === 0) continue;
    const raw = matches[matches.length - 1]?.[1];
    if (!raw) continue;
    const value = new Prisma.Decimal(raw);
    if (value.greaterThan(0)) {
      return value;
    }
  }
  return null;
}

function emptyCounters(): Counters {
  return {
    tracksCreated: 0,
    itemsMoved: 0,
    itemsCloned: 0,
    itemsNormalized: 0,
    emptyGroupsRemoved: 0,
    trackGroupsUpserted: 0,
    electivesAssigned: 0,
  };
}

function addCounters(target: Counters, delta: Counters): void {
  target.tracksCreated += delta.tracksCreated;
  target.itemsMoved += delta.itemsMoved;
  target.itemsCloned += delta.itemsCloned;
  target.itemsNormalized += delta.itemsNormalized;
  target.emptyGroupsRemoved += delta.emptyGroupsRemoved;
  target.trackGroupsUpserted += delta.trackGroupsUpserted;
  target.electivesAssigned += delta.electivesAssigned;
}

async function processVersion(
  programCode: string,
  versionId: string,
): Promise<Counters> {
  const counters = emptyCounters();

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
  if (matched.length === 0 && existingTracks.length === 0) {
    return counters;
  }

  await prisma.$transaction(
    async (tx) => {
      if (matched.length > 0) {
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
      }

      const versionTracks = await tx.programTrack.findMany({
        where: { versionId },
        select: { id: true, trackCode: true, trackName: true },
        orderBy: [{ sortOrder: 'asc' }, { trackCode: 'asc' }],
      });
      if (versionTracks.length === 0) {
        return;
      }

      // Repair pass (a): Re-normalize isElective on existing track items for CNTT-CN-DT / CNTT-KS-DT.
      if (programCode === 'CNTT-CN-DT' || programCode === 'CNTT-KS-DT') {
        const trackCodeById = new Map(
          versionTracks.map((t) => [t.id, t.trackCode]),
        );
        const compulsoryTrackItems = await tx.curriculumItem.findMany({
          where: {
            versionId,
            trackId: { not: null },
            isElective: false,
            note: { not: null },
          },
          select: { id: true, trackId: true, note: true },
        });
        for (const ci of compulsoryTrackItems) {
          if (!ci.trackId || !ci.note) continue;
          if (COMPULSORY_RE.test(normalizeVietnamese(ci.note))) continue;
          const trackCode = trackCodeById.get(ci.trackId);
          if (!trackCode) continue;
          const parsed = parseTrackAssignments(programCode, ci.note, true);
          const match = parsed.find((a) => a.trackCode === trackCode);
          if (match?.isElective) {
            await tx.curriculumItem.update({
              where: { id: ci.id },
              data: { isElective: true },
            });
            counters.itemsNormalized += 1;
          }
        }
      }

      // Repair pass (b): Remove emptied leftover common-core ElectiveGroups.
      const commonGroups = await tx.electiveGroup.findMany({
        where: { versionId, trackId: null },
        select: {
          id: true,
          minCredits: true,
          minCourses: true,
          _count: { select: { items: true } },
        },
      });
      const emptyCommonGroupIds = commonGroups
        .filter((g) => g._count.items === 0)
        .map((g) => g.id);
      if (emptyCommonGroupIds.length > 0) {
        const deleted = await tx.electiveGroup.deleteMany({
          where: { id: { in: emptyCommonGroupIds } },
        });
        counters.emptyGroupsRemoved += deleted.count;
      }

      // Repair pass (c): Create track-scoped ElectiveGroups & assign orphan track elective items.
      const version = await tx.programVersion.findUniqueOrThrow({
        where: { id: versionId },
        select: { electiveCredits: true },
      });
      const remainingCommonGroups = commonGroups.filter(
        (g) => g._count.items > 0,
      );
      const commonItems = await tx.curriculumItem.findMany({
        where: { versionId, trackId: null },
        select: {
          isElective: true,
          electiveGroupId: true,
          creditsSnapshot: true,
          course: { select: { credits: true } },
        },
      });
      const commonCredits = programCredits(
        commonItems.map((ci) => ({
          credits: rowCredits(ci),
          isElective: ci.isElective,
          electiveGroupId: ci.electiveGroupId,
        })),
        remainingCommonGroups.map((g) => ({
          id: g.id,
          minCredits: g.minCredits,
          minCourses: g.minCourses,
        })),
      );
      const remainingElective = version.electiveCredits.minus(
        commonCredits.elective,
      );

      for (const track of versionTracks) {
        const groupCode = `TC-${track.trackCode}`;
        const existingTrackGroup = await tx.electiveGroup.findUnique({
          where: { versionId_groupCode: { versionId, groupCode } },
          select: { id: true },
        });
        const trackElectives = await tx.curriculumItem.findMany({
          where: { versionId, trackId: track.id, isElective: true },
          select: {
            id: true,
            electiveGroupId: true,
            note: true,
            creditsSnapshot: true,
            course: { select: { credits: true } },
          },
        });
        const orphanElectives = trackElectives.filter(
          (ci) => ci.electiveGroupId === null,
        );
        if (orphanElectives.length === 0) {
          continue;
        }

        const targetItems = trackElectives.filter(
          (ci) =>
            ci.electiveGroupId === null ||
            (existingTrackGroup !== null &&
              ci.electiveGroupId === existingTrackGroup.id),
        );
        const offered = targetItems.reduce(
          (sum, ci) => sum.plus(rowCredits(ci)),
          ZERO,
        );
        if (offered.lessThanOrEqualTo(0)) {
          continue;
        }

        let minCredits: Prisma.Decimal;
        if (
          remainingElective.greaterThan(0) &&
          remainingElective.lessThanOrEqualTo(offered)
        ) {
          minCredits = remainingElective;
        } else {
          const fromNotes = extractChooseCreditsFromNotes(
            targetItems.map((ci) => ci.note),
          );
          minCredits =
            fromNotes !== null
              ? Prisma.Decimal.min(fromNotes, offered)
              : offered;
        }

        const trackGroup = await tx.electiveGroup.upsert({
          where: { versionId_groupCode: { versionId, groupCode } },
          create: {
            versionId,
            trackId: track.id,
            groupCode,
            groupName: `Tự chọn ${track.trackName}`,
            minCredits,
            minCourses: null,
          },
          update: {
            trackId: track.id,
            groupName: `Tự chọn ${track.trackName}`,
            minCredits,
            minCourses: null,
          },
          select: { id: true },
        });
        counters.trackGroupsUpserted += 1;

        const updated = await tx.curriculumItem.updateMany({
          where: { id: { in: orphanElectives.map((ci) => ci.id) } },
          data: { electiveGroupId: trackGroup.id },
        });
        counters.electivesAssigned += updated.count;
      }

      // Repair pass (d): Recompute ProgramTrack.compulsoryCredits & electiveCredits.
      const tracksForTotals = await tx.programTrack.findMany({
        where: { versionId },
        select: {
          id: true,
          curriculumItems: {
            select: {
              isElective: true,
              electiveGroupId: true,
              creditsSnapshot: true,
              course: { select: { credits: true } },
            },
          },
          electiveGroups: {
            select: {
              id: true,
              minCredits: true,
              minCourses: true,
            },
          },
        },
      });
      for (const track of tracksForTotals) {
        let compulsory = ZERO;
        let offeredElective = ZERO;
        for (const ci of track.curriculumItems) {
          const credits = rowCredits(ci);
          if (ci.isElective) {
            offeredElective = offeredElective.plus(credits);
          } else {
            compulsory = compulsory.plus(credits);
          }
        }
        const elective =
          track.electiveGroups.length > 0
            ? track.electiveGroups.reduce((sum, g) => {
                const memberCredits = track.curriculumItems
                  .filter((ci) => ci.electiveGroupId === g.id)
                  .map(rowCredits);
                return sum.plus(groupRequiredCredits(g, memberCredits));
              }, ZERO)
            : offeredElective;

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

  const total = emptyCounters();
  for (const program of programs) {
    const sum = emptyCounters();
    for (const version of program.versions) {
      const c = await processVersion(program.programCode, version.id);
      addCounters(sum, c);
    }
    console.log(
      `${program.programCode}: versions=${program.versions.length} tracksCreated=${sum.tracksCreated} itemsMoved=${sum.itemsMoved} itemsCloned=${sum.itemsCloned} itemsNormalized=${sum.itemsNormalized} emptyGroupsRemoved=${sum.emptyGroupsRemoved} trackGroupsUpserted=${sum.trackGroupsUpserted} electivesAssigned=${sum.electivesAssigned}`,
    );
    addCounters(total, sum);
  }
  console.log(
    `TOTAL: programs=${programs.length} tracksCreated=${total.tracksCreated} itemsMoved=${total.itemsMoved} itemsCloned=${total.itemsCloned} itemsNormalized=${total.itemsNormalized} emptyGroupsRemoved=${total.emptyGroupsRemoved} trackGroupsUpserted=${total.trackGroupsUpserted} electivesAssigned=${total.electivesAssigned}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
