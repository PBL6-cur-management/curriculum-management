import { describe, expect, it } from 'vitest';
import { buildOrgTree } from './buildOrgTree';

const unit = (
  id: string,
  unitName: string,
  unitType: 'UNIVERSITY' | 'FACULTY' | 'OFFICE',
  parentUnitId: string | null,
) => ({
  id,
  unitCode: id,
  unitName,
  unitType,
  isExternal: false,
  parentUnitId,
  status: 'ACTIVE' as const,
});
describe('buildOrgTree', () => {
  it('sorts Vietnamese unit names, places groups under faculties and ignores missing parents', () => {
    const university = unit('u', 'Trường', 'UNIVERSITY', null);
    const faculty = unit('f', 'Dân', 'FACULTY', 'u');
    const nextFaculty = unit('f2', 'Điện', 'FACULTY', 'u');
    const office = unit('o', 'Phòng', 'OFFICE', 'u');
    const group = {
      id: 'g',
      groupCode: 'G1',
      groupName: 'Nhóm',
      status: 'ACTIVE' as const,
      faculty: { id: 'f', unitCode: 'f', unitName: 'Dân' },
      activeMemberCount: 0,
      activeCoordinators: [],
      hasActiveCoordinator: false,
    };
    const tree = buildOrgTree(
      [
        unit('lost', 'Mồ côi', 'OFFICE', 'missing'),
        nextFaculty,
        faculty,
        university,
        office,
      ],
      [group],
    );
    expect(tree[0].kind === 'unit' && tree[0].unit).toEqual(university);
    expect(
      tree[0].children.map((node) =>
        node.kind === 'unit' ? node.unit.unitName : node.group.groupName,
      ),
    ).toEqual(['Dân', 'Điện', 'Phòng']);
    expect(tree[0].children[0].children[0].kind).toBe('group');
  });
});
