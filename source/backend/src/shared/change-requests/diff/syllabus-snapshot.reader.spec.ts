import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { diffSnapshots } from './snapshot-differ.js';
import { SNAPSHOT_ENTITY } from './snapshot-entry.js';
import { readSyllabusSnapshot } from './syllabus-snapshot.reader.js';

function dbWith(row: Record<string, unknown>) {
  return {
    syllabus: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 's',
        courseDescription: null,
        englishDescription: null,
        objectives: null,
        teachingMethods: null,
        assessmentMethods: null,
        references: null,
        weeklyContents: [],
        clos: [],
        failingScore: null,
        assessmentComponents: [],
        ...row,
      }),
    },
  } as unknown as PrismaService;
}

const component = (weight: string, cloWeight: string | null, id = 'a') => ({
  id,
  componentCode: 'GK',
  componentName: 'Giữa kỳ',
  weight: new Prisma.Decimal(weight),
  assessmentForm: null,
  isConditional: false,
  conditionThreshold: null,
  failingScore: null,
  mappings: [
    {
      id: `m${id}`,
      cloWeight: cloWeight === null ? null : new Prisma.Decimal(cloWeight),
      clo: { cloCode: 'CLO1' },
    },
  ],
});

describe('readSyllabusSnapshot grade formula', () => {
  it('keys components by code and mappings by code and CLO code, not by row id', async () => {
    const entries = await readSyllabusSnapshot(
      dbWith({
        failingScore: new Prisma.Decimal('4'),
        assessmentComponents: [component('100', '50')],
      }),
      's',
    );

    const keys = entries
      .filter((e) =>
        [
          SNAPSHOT_ENTITY.FORMULA,
          SNAPSHOT_ENTITY.COMPONENT,
          SNAPSHOT_ENTITY.CLO_MAPPING,
        ].includes(e.entityType as never),
      )
      .map((e) => `${e.entityType}:${e.itemKey}`);
    expect(keys).toEqual([
      'FORMULA:failingScore',
      'COMPONENT:GK',
      'CLO_MAPPING:GK/CLO1',
    ]);
  });

  it('is silent for a copy that only has different row ids and equivalent decimals', async () => {
    const before = await readSyllabusSnapshot(
      dbWith({ assessmentComponents: [component('100', '50', 'a')] }),
      's',
    );
    const after = await readSyllabusSnapshot(
      dbWith({ assessmentComponents: [component('100.00', '50.0', 'b')] }),
      's',
    );

    expect(diffSnapshots(before, after, 'base')).toEqual([]);
  });

  it('reports a changed weight, a removed link and a null-to-zero link weight', async () => {
    const before = await readSyllabusSnapshot(
      dbWith({ assessmentComponents: [component('100', null)] }),
      's',
    );
    const after = await readSyllabusSnapshot(
      dbWith({
        assessmentComponents: [
          { ...component('90', '0'), mappings: component('90', '0').mappings },
        ],
      }),
      's',
    );

    const drafts = diffSnapshots(before, after, 'base');
    expect(drafts.map((d) => `${d.entityType}:${d.itemKey}`).sort()).toEqual([
      'CLO_MAPPING:GK/CLO1',
      'COMPONENT:GK',
    ]);
  });
});
