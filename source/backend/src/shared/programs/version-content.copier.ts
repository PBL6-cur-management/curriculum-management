import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { revisionForItems } from '../syllabi/revision-for-items.js';

export interface CopyOptions {
  // Keep what a release froze on each row: the name and credits it was released with and its syllabus revision.
  // A working copy, a fan-out shell and a correction carry it; a clone is a new program and reads the live course again.
  carryRelease?: boolean;
}

// Copies everything that hangs off a program version into another version, inside the caller's transaction.
// Each feature that adds version-owned tables adds its step here: clone (FR-25) and the Draft of a change request depend on it.
// F-07 added the elective groups, curriculum rows and their requisites; F-11 added the PLOs and both matrices after them
// (the old id -> new id maps of the rows and PLOs are what a matrix step needs). F-15 added the frozen row facts.
@Injectable()
export class VersionContentCopier {
  async copy(
    tx: Prisma.TransactionClient,
    fromVersionId: string,
    toVersionId: string,
    { carryRelease = true }: CopyOptions = {},
  ): Promise<void> {
    const trackIds = await this.copyTracks(tx, fromVersionId, toVersionId);
    const groupIds = await this.copyElectiveGroups(
      tx,
      fromVersionId,
      toVersionId,
      trackIds,
    );
    const itemIds = await this.copyCurriculumItems(
      tx,
      fromVersionId,
      toVersionId,
      trackIds,
      groupIds,
      carryRelease,
    );
    await this.copyRequisites(tx, itemIds);
    const ploIds = await this.copyPlos(tx, fromVersionId, toVersionId);
    await this.copyCoursePloMappings(tx, itemIds, ploIds);
    await this.copyCloPloLinks(tx, itemIds, ploIds, carryRelease);
  }

  private async copyTracks(
    tx: Prisma.TransactionClient,
    from: string,
    to: string,
  ): Promise<Map<string, string>> {
    const tracks = tx.programTrack
      ? await tx.programTrack.findMany({ where: { versionId: from } })
      : [];
    if (tracks.length === 0) {
      return new Map();
    }
    await tx.programTrack.createMany({
      data: tracks.map(
        ({
          trackCode,
          trackName,
          englishName,
          description,
          sortOrder,
          compulsoryCredits,
          electiveCredits,
        }) => ({
          versionId: to,
          trackCode,
          trackName,
          englishName,
          description,
          sortOrder,
          compulsoryCredits,
          electiveCredits,
        }),
      ),
    });
    const created = await tx.programTrack.findMany({
      where: { versionId: to },
      select: { id: true, trackCode: true },
    });
    const newIdByCode = new Map(
      created.map((track) => [track.trackCode, track.id]),
    );
    return new Map(
      tracks.map((track) => [track.id, newIdByCode.get(track.trackCode)!]),
    );
  }

  // Returns old id -> new id, matched back through the natural key (groupCode) because createMany returns no rows.
  private async copyElectiveGroups(
    tx: Prisma.TransactionClient,
    from: string,
    to: string,
    trackIds: ReadonlyMap<string, string>,
  ): Promise<Map<string, string>> {
    const groups = await tx.electiveGroup.findMany({
      where: { versionId: from },
    });
    if (groups.length === 0) {
      return new Map();
    }
    await tx.electiveGroup.createMany({
      data: groups.map(
        ({ groupCode, groupName, minCredits, minCourses, trackId }) => ({
          versionId: to,
          trackId: trackId ? (trackIds.get(trackId) ?? null) : null,
          groupCode,
          groupName,
          minCredits,
          minCourses,
        }),
      ),
    });
    const created = await tx.electiveGroup.findMany({
      where: { versionId: to },
      select: { id: true, groupCode: true },
    });
    const newIdByCode = new Map(
      created.map((group) => [group.groupCode, group.id]),
    );
    return new Map(
      groups.map((group) => [group.id, newIdByCode.get(group.groupCode)!]),
    );
  }

  // Returns old id -> new id, matched back through the natural key (trackId + courseId).
  private async copyCurriculumItems(
    tx: Prisma.TransactionClient,
    from: string,
    to: string,
    trackIds: ReadonlyMap<string, string>,
    groupIds: ReadonlyMap<string, string>,
    carryRelease: boolean,
  ): Promise<Map<string, string>> {
    const items = await tx.curriculumItem.findMany({
      where: { versionId: from },
    });
    if (items.length === 0) {
      return new Map();
    }
    await tx.curriculumItem.createMany({
      data: items.map((item) => ({
        versionId: to,
        trackId: item.trackId ? (trackIds.get(item.trackId) ?? null) : null,
        plannedSemester: item.plannedSemester,
        sortOrder: item.sortOrder,
        courseId: item.courseId,
        blockSymbol: item.blockSymbol,
        isElective: item.isElective,
        electiveGroupId: item.electiveGroupId
          ? groupIds.get(item.electiveGroupId)!
          : null,
        htDa: item.htDa,
        tqDa: item.tqDa,
        minStudiedScore: item.minStudiedScore,
        minTransferScore: item.minTransferScore,
        note: item.note,
        ...(carryRelease && {
          courseNameSnapshot: item.courseNameSnapshot,
          creditsSnapshot: item.creditsSnapshot,
          syllabusId: item.syllabusId,
        }),
      })),
    });
    const created = await tx.curriculumItem.findMany({
      where: { versionId: to },
      select: { id: true, trackId: true, courseId: true },
    });
    const keyOf = (tId: string | null, cId: string) => `${tId ?? ''}::${cId}`;
    const newIdByKey = new Map(
      created.map((item) => [keyOf(item.trackId, item.courseId), item.id]),
    );
    return new Map(
      items.map((item) => {
        const mappedTrack = item.trackId
          ? (trackIds.get(item.trackId) ?? null)
          : null;
        return [item.id, newIdByKey.get(keyOf(mappedTrack, item.courseId))!];
      }),
    );
  }

  private async copyRequisites(
    tx: Prisma.TransactionClient,
    itemIds: ReadonlyMap<string, string>,
  ): Promise<void> {
    if (itemIds.size === 0) {
      return;
    }
    const requisites = await tx.curriculumRequisite.findMany({
      where: { itemId: { in: [...itemIds.keys()] } },
    });
    if (requisites.length === 0) {
      return;
    }
    await tx.curriculumRequisite.createMany({
      data: requisites.map(
        ({ itemId, sourceCourseId, relationType, minScore }) => ({
          itemId: itemIds.get(itemId)!,
          sourceCourseId,
          relationType,
          minScore,
        }),
      ),
    });
  }

  // Returns old id -> new id, matched back through the natural key (ploCode).
  private async copyPlos(
    tx: Prisma.TransactionClient,
    from: string,
    to: string,
  ): Promise<Map<string, string>> {
    const plos = await tx.pLO.findMany({ where: { versionId: from } });
    if (plos.length === 0) {
      return new Map();
    }
    await tx.pLO.createMany({
      data: plos.map(
        ({
          ploCode,
          description,
          englishDescription,
          competencyGroup,
          sortOrder,
        }) => ({
          versionId: to,
          ploCode,
          description,
          englishDescription,
          competencyGroup,
          sortOrder,
        }),
      ),
    });
    const created = await tx.pLO.findMany({
      where: { versionId: to },
      select: { id: true, ploCode: true },
    });
    const newIdByCode = new Map(created.map((plo) => [plo.ploCode, plo.id]));
    return new Map(plos.map((plo) => [plo.id, newIdByCode.get(plo.ploCode)!]));
  }

  private async copyCoursePloMappings(
    tx: Prisma.TransactionClient,
    itemIds: ReadonlyMap<string, string>,
    ploIds: ReadonlyMap<string, string>,
  ): Promise<void> {
    if (itemIds.size === 0 || ploIds.size === 0) {
      return;
    }
    const cells = await tx.coursePLOMapping.findMany({
      where: { curriculumItemId: { in: [...itemIds.keys()] } },
    });
    await tx.coursePLOMapping.createMany({
      data: cells.map(({ curriculumItemId, ploId, weight }) => ({
        curriculumItemId: itemIds.get(curriculumItemId)!,
        ploId: ploIds.get(ploId)!,
        weight,
      })),
    });
  }

  // CLO ids are kept while the copy shares the revision (a pinned row, or a Draft). A copy that reads the live course
  // again maps its links onto the CLOs of the revision it now reads, by cloCode; a code that revision lacks drops the link.
  private async copyCloPloLinks(
    tx: Prisma.TransactionClient,
    itemIds: ReadonlyMap<string, string>,
    ploIds: ReadonlyMap<string, string>,
    carryRelease: boolean,
  ): Promise<void> {
    if (itemIds.size === 0 || ploIds.size === 0) {
      return;
    }
    const links = await tx.cLOPLOMapping.findMany({
      where: { curriculumItemId: { in: [...itemIds.keys()] } },
    });
    const cloIdFor = carryRelease
      ? (_itemId: string, cloId: string) => cloId
      : await this.remapClos(tx, itemIds, links);
    const data = links.flatMap(({ curriculumItemId, ploId, cloId }) => {
      const mapped = cloIdFor(curriculumItemId, cloId);
      return mapped
        ? [
            {
              curriculumItemId: itemIds.get(curriculumItemId)!,
              ploId: ploIds.get(ploId)!,
              cloId: mapped,
            },
          ]
        : [];
    });
    if (data.length > 0) await tx.cLOPLOMapping.createMany({ data });
  }

  private async remapClos(
    tx: Prisma.TransactionClient,
    itemIds: ReadonlyMap<string, string>,
    links: readonly { curriculumItemId: string; cloId: string }[],
  ): Promise<(itemId: string, cloId: string) => string | null> {
    const newItems = await tx.curriculumItem.findMany({
      where: { id: { in: [...itemIds.values()] } },
      select: { id: true, courseId: true, syllabusId: true },
    });
    const revisions = await revisionForItems(tx, newItems);
    const oldClos = await tx.cLO.findMany({
      where: { id: { in: [...new Set(links.map((link) => link.cloId))] } },
      select: { id: true, cloCode: true },
    });
    const codeOf = new Map(oldClos.map((clo) => [clo.id, clo.cloCode]));
    const revisionIds = [
      ...new Set([...revisions.values()].flatMap((r) => (r ? [r.id] : []))),
    ];
    const newClos = await tx.cLO.findMany({
      where: { syllabusId: { in: revisionIds } },
      select: { id: true, syllabusId: true, cloCode: true },
    });
    const idByRevisionCode = new Map(
      newClos.map((clo) => [`${clo.syllabusId}:${clo.cloCode}`, clo.id]),
    );
    return (oldItemId, cloId) => {
      const revision = revisions.get(itemIds.get(oldItemId)!);
      const code = codeOf.get(cloId);
      return revision && code
        ? (idByRevisionCode.get(`${revision.id}:${code}`) ?? null)
        : null;
    };
  }
}
