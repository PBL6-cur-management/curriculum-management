import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OrgUnitStatus,
  OrgUnitType,
  Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../shared/prisma/prisma.service.js';
import { CreateOrgUnitDto } from './create-org-unit.dto.js';
import { OrgUnitsService } from './org-units.service.js';

const ROOT = {
  id: 'root',
  unitCode: 'ROOT',
  unitName: 'Root',
  unitType: OrgUnitType.UNIVERSITY,
  isExternal: false,
  parentUnitId: null,
  status: OrgUnitStatus.ACTIVE,
};
const UNIT = {
  ...ROOT,
  id: 'unit',
  unitCode: 'UNIT',
  unitType: OrgUnitType.FACULTY,
  parentUnitId: ROOT.id,
};
const DTO: CreateOrgUnitDto = {
  unitCode: 'NEW',
  unitName: 'New',
  unitType: OrgUnitType.FACULTY,
  parentUnitId: ROOT.id,
};

describe('OrgUnitsService', () => {
  let findUnique: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  let create: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>;
  let countChildren: ReturnType<typeof vi.fn>;
  let countGroups: ReturnType<typeof vi.fn>;
  let service: OrgUnitsService;

  beforeEach(() => {
    findUnique = vi.fn().mockResolvedValue(ROOT);
    findMany = vi.fn().mockResolvedValue([]);
    create = vi.fn().mockResolvedValue(UNIT);
    update = vi.fn().mockResolvedValue(UNIT);
    countChildren = vi.fn().mockResolvedValue(0);
    countGroups = vi.fn().mockResolvedValue(0);
    service = new OrgUnitsService({
      orgUnit: {
        findUnique,
        create,
        update,
        count: countChildren,
        findMany,
      },
      subjectGroup: { count: countGroups },
    } as unknown as PrismaService);
  });

  it('creates under an active university and rejects invalid parents', async () => {
    expect(await service.create(DTO, 'actor')).toEqual(UNIT);
    findUnique.mockResolvedValue({ ...ROOT, status: OrgUnitStatus.INACTIVE });
    await expect(service.create(DTO, 'actor')).rejects.toMatchObject({
      code: 'PARENT_INACTIVE',
    });
    findUnique.mockResolvedValue(UNIT);
    await expect(service.create(DTO, 'actor')).rejects.toMatchObject({
      code: 'PARENT_INVALID',
    });
  });

  it('maps duplicate unit codes to a field error and rethrows unrelated failures', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.create(DTO, 'actor')).rejects.toMatchObject({
      code: 'UNIT_CODE_TAKEN',
      details: [{ field: 'unitCode', constraints: ['unique'] }],
    });
    const failure = new Error('database unavailable');
    create.mockRejectedValue(failure);
    await expect(service.create(DTO, 'actor')).rejects.toBe(failure);
  });

  it('locks root movement and deactivation', async () => {
    await expect(
      service.update(ROOT.id, { parentUnitId: 'other' }, 'actor'),
    ).rejects.toMatchObject({ code: 'ROOT_UNIT_LOCKED' });
    await expect(service.deactivate(ROOT.id, 'actor')).rejects.toMatchObject({
      code: 'ROOT_UNIT_LOCKED',
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses deactivation with active children or groups', async () => {
    findUnique.mockResolvedValue(UNIT);
    countChildren.mockResolvedValue(1);
    await expect(service.deactivate(UNIT.id, 'actor')).rejects.toMatchObject({
      code: 'UNIT_HAS_ACTIVE_CHILDREN',
    });
    countChildren.mockResolvedValue(0);
    countGroups.mockResolvedValue(1);
    await expect(service.deactivate(UNIT.id, 'actor')).rejects.toMatchObject({
      code: 'UNIT_HAS_ACTIVE_GROUPS',
    });
  });

  it('deactivates idempotently and refuses activation under an inactive parent', async () => {
    const inactive = { ...UNIT, status: OrgUnitStatus.INACTIVE };
    findUnique
      .mockResolvedValueOnce(UNIT)
      .mockResolvedValueOnce(inactive)
      .mockResolvedValueOnce(inactive)
      .mockResolvedValueOnce({ ...ROOT, status: OrgUnitStatus.INACTIVE });
    update.mockResolvedValue(inactive);
    expect(await service.deactivate(UNIT.id, 'actor')).toEqual(inactive);
    expect(await service.deactivate(UNIT.id, 'actor')).toEqual(inactive);
    expect(update).toHaveBeenCalledTimes(1);
    await expect(service.activate(UNIT.id, 'actor')).rejects.toMatchObject({
      code: 'PARENT_INACTIVE',
    });
  });

  it('supports isExternal on create/update/list and normalizes extra spaces', async () => {
    const externalUnit = { ...UNIT, isExternal: true, unitName: 'ĐH Ngoại ngữ' };
    create.mockResolvedValueOnce(externalUnit);
    const created = await service.create(
      {
        ...DTO,
        unitName: '  ĐH   Ngoại ngữ  ',
        isExternal: true,
      },
      'actor',
    );
    expect(created.isExternal).toBe(true);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          unitCode: 'NEW',
          unitName: 'ĐH Ngoại ngữ',
          isExternal: true,
        }),
      }),
    );

    findMany.mockResolvedValueOnce([externalUnit]);
    const listed = await service.list({ isExternal: true });
    expect(listed).toEqual([externalUnit]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isExternal: true },
      }),
    );

    findUnique.mockResolvedValueOnce(UNIT);
    update.mockResolvedValueOnce(externalUnit);
    const updated = await service.update(
      UNIT.id,
      { unitName: '  ĐH   Ngoại ngữ ', isExternal: true },
      'actor',
    );
    expect(updated.isExternal).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: UNIT.id },
        data: {
          unitName: 'ĐH Ngoại ngữ',
          isExternal: true,
          parentUnitId: undefined,
        },
      }),
    );
  });
});
