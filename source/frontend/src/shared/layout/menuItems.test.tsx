import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../routes';
import {
  APP_MENU,
  openMenuGroups,
  selectedMenuPath,
  toMenuItems,
} from './menuItems';
import { activeSectionPath, SECTIONS } from './SectionNav';

type Entry = ReturnType<typeof toMenuItems>[number];

const PROGRAMS = 'group:Chương trình đào tạo';
const APPROVALS = 'group:Đề xuất và phê duyệt';
const STUDENTS = 'group:Sinh viên';
const DATA = 'group:Dữ liệu và tích hợp';
const ADMIN = 'group:Quản trị';

function childKeys(menu: Entry[], group: string): unknown[] | undefined {
  const found = menu.find((item) => item.key === group);
  return found && 'children' in found
    ? found.children.map((child) => child.key)
    : undefined;
}

const leafKeys = (menu: Entry[]): unknown[] =>
  menu.flatMap((item) =>
    'children' in item ? leafKeys(item.children) : [item.key],
  );

describe('app menu', () => {
  it('puts the two core jobs first, then the secondary groups', () => {
    const everything = toMenuItems(
      APP_MENU,
      [
        'program.view',
        'course.view',
        'semester.manage',
        'changeRequest.view',
        'delegation.manage',
        'student.viewProgress',
        'graduation.view',
        'report.benchmark',
        'data.importExcel',
        'syncConfigure' as never,
        'user.manage',
        'permission.view',
      ],
      ['R1'],
    ).map((item) => item.key);
    expect(everything.slice(0, 4)).toEqual([
      ROUTES.home,
      ROUTES.notifications,
      PROGRAMS,
      APPROVALS,
    ]);
    expect(everything).toEqual(
      expect.arrayContaining([STUDENTS, 'group:Báo cáo', DATA, ADMIN]),
    );
  });

  it('opens the core groups on arrival, plus the group of the current page', () => {
    expect(openMenuGroups(APP_MENU, ROUTES.home)).toEqual([
      PROGRAMS,
      APPROVALS,
    ]);
    expect(openMenuGroups(APP_MENU, ROUTES.users)).toEqual([
      PROGRAMS,
      APPROVALS,
      ADMIN,
    ]);
  });

  it('shows graduation as one entry to permitted staff, including mixed staff/student identities', () => {
    for (const roles of [['R1'], ['R3'], ['R6', 'R3']])
      expect(
        childKeys(toMenuItems(APP_MENU, ['graduation.audit'], roles), STUDENTS),
      ).toEqual([ROUTES.graduation]);
    for (const roles of [['R2'], ['R4'], ['R5'], ['R6'], ['R5', 'R6']])
      expect(
        toMenuItems(
          APP_MENU,
          ['graduation.view', 'graduation.audit'],
          roles,
        ).map((item) => item.key),
      ).not.toContain(STUDENTS);
    expect(
      toMenuItems(APP_MENU, [], ['R1']).map((item) => item.key),
    ).not.toContain(STUDENTS);
    expect(selectedMenuPath(APP_MENU, '/graduation/batches/batch')).toBe(
      ROUTES.graduation,
    );
    expect(selectedMenuPath(APP_MENU, '/graduation/audits/audit')).toBe(
      ROUTES.graduation,
    );
  });

  it('shows student records only to R1/R3 staff including multi-role users', () => {
    for (const roles of [['R1'], ['R3'], ['R6', 'R3']])
      expect(
        leafKeys(toMenuItems(APP_MENU, ['student.viewProgress'], roles)),
      ).toContain(ROUTES.students);
    for (const roles of [['R6'], ['R5']])
      expect(
        leafKeys(toMenuItems(APP_MENU, ['student.viewProgress'], roles)),
      ).not.toContain(ROUTES.students);
  });

  it('keeps one import entry for data-only permission; its history is a tab', () => {
    const keys = leafKeys(toMenuItems(APP_MENU, ['data.importExcel'], ['R1']));
    expect(keys).toContain(ROUTES.imports);
    expect(keys).not.toContain(ROUTES.importHistory);
    expect(keys).not.toContain(ROUTES.students);
    expect(selectedMenuPath(APP_MENU, '/imports/history/b1')).toBe(
      ROUTES.imports,
    );
  });

  it('selects the courses entry on the equivalence groups tab', () => {
    const menu = toMenuItems(APP_MENU, ['course.view']);
    expect(childKeys(menu, PROGRAMS)).toEqual([ROUTES.courses]);
    expect(selectedMenuPath(APP_MENU, ROUTES.equivalenceGroups)).toBe(
      ROUTES.courses,
    );
    expect(selectedMenuPath(APP_MENU, '/courses/c1/edit')).toBe(ROUTES.courses);
  });

  it('hides a group the caller can open nothing in', () => {
    const keys = toMenuItems(APP_MENU, ['user.manage']).map((item) => item.key);
    expect(keys).not.toContain(PROGRAMS);
    expect(keys).not.toContain(APPROVALS);
    expect(keys).toContain(ADMIN);
  });

  it('lists the programs for staff and hides them for a caller who only holds the student role', () => {
    const permissions = ['program.view' as const];
    expect(leafKeys(toMenuItems(APP_MENU, permissions, ['R2']))).toContain(
      ROUTES.programs,
    );
    expect(leafKeys(toMenuItems(APP_MENU, permissions, ['R6']))).not.toContain(
      ROUTES.programs,
    );
    // A student who also holds a staff role keeps the entry.
    expect(
      leafKeys(toMenuItems(APP_MENU, permissions, ['R6', 'R5'])),
    ).toContain(ROUTES.programs);
    expect(selectedMenuPath(APP_MENU, '/programs/p1/edit')).toBe(
      ROUTES.programs,
    );
  });

  it('shows the notifications to everyone and the approval group only to holders of changeRequest.view', () => {
    const without = toMenuItems(APP_MENU, ['course.view']);
    expect(without.map((item) => item.key)).toContain(ROUTES.notifications);
    expect(leafKeys(without)).not.toContain(ROUTES.approvalQueue);
    const withView = toMenuItems(APP_MENU, ['changeRequest.view']);
    expect(childKeys(withView, APPROVALS)).toEqual([
      ROUTES.approvalQueue,
      ROUTES.changeRequests,
    ]);
  });

  it('lists the semesters only for holders of semester.manage', () => {
    const keys = (permissions: string[]) =>
      leafKeys(toMenuItems(APP_MENU, permissions as never));
    expect(keys(['semester.manage'])).toContain(ROUTES.semesters);
    expect(keys(['course.view'])).not.toContain(ROUTES.semesters);
  });
});

describe('section tabs', () => {
  it('picks the longest matching tab, so a history detail is not taken for the import page', () => {
    expect(activeSectionPath(SECTIONS.imports, '/imports/history/b1')).toBe(
      ROUTES.importHistory,
    );
    expect(activeSectionPath(SECTIONS.imports, ROUTES.imports)).toBe(
      ROUTES.imports,
    );
    expect(
      activeSectionPath(SECTIONS.graduation, '/graduation/batches/b1'),
    ).toBe(ROUTES.graduationBatches);
    expect(activeSectionPath(SECTIONS.courses, '/elsewhere')).toBeUndefined();
  });
});
