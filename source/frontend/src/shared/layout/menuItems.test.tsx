import { describe, expect, it } from 'vitest';
import { ROUTES } from '../../routes';
import {
  APP_MENU,
  openMenuGroups,
  selectedMenuPath,
  toMenuItems,
} from './menuItems';

describe('app menu', () => {
  it('shows graduation leaves only to permitted staff and keeps mixed staff/student identities', () => {
    for (const roles of [['R1'], ['R3'], ['R6', 'R3']]) {
      const menu = toMenuItems(
        APP_MENU,
        ['graduation.view', 'graduation.audit'],
        roles,
      );
      const group = menu.find((item) => item.key === 'group:Xét tốt nghiệp');
      expect(
        group && 'children' in group && group.children.map((item) => item.key),
      ).toEqual([ROUTES.graduationBatches, ROUTES.graduation]);
    }
    for (const roles of [['R2'], ['R4'], ['R5'], ['R6'], ['R5', 'R6']])
      expect(
        toMenuItems(
          APP_MENU,
          ['graduation.view', 'graduation.audit'],
          roles,
        ).map((item) => item.key),
      ).not.toContain('group:Xét tốt nghiệp');
    expect(
      toMenuItems(APP_MENU, [], ['R1']).map((item) => item.key),
    ).not.toContain('group:Xét tốt nghiệp');
    const viewOnly = toMenuItems(APP_MENU, ['graduation.view'], ['R3']).find(
      (item) => item.key === 'group:Xét tốt nghiệp',
    );
    expect(
      viewOnly &&
        'children' in viewOnly &&
        viewOnly.children.map((item) => item.key),
    ).toEqual([ROUTES.graduation]);
    expect(selectedMenuPath(APP_MENU, '/graduation/batches/batch')).toBe(
      ROUTES.graduationBatches,
    );
    expect(selectedMenuPath(APP_MENU, '/graduation/audits/audit')).toBe(
      ROUTES.graduation,
    );
  });
  it('shows student records only to R1/R3 staff including multi-role users', () => {
    for (const roles of [['R1'], ['R3'], ['R6', 'R3']])
      expect(
        toMenuItems(APP_MENU, ['student.viewProgress'], roles).map(
          (item) => item.key,
        ),
      ).toContain(ROUTES.students);
    for (const roles of [['R6'], ['R5']])
      expect(
        toMenuItems(APP_MENU, ['student.viewProgress'], roles).map(
          (item) => item.key,
        ),
      ).not.toContain(ROUTES.students);
  });
  it('opens import navigation for data-only permission without broadening other entries', () => {
    const keys = toMenuItems(APP_MENU, ['data.importExcel'], ['R1']).map(
      (item) => item.key,
    );
    expect(keys).toContain(ROUTES.imports);
    expect(keys).toContain(ROUTES.importHistory);
    expect(keys).not.toContain(ROUTES.students);
  });
  it('nests the equivalence groups under Học phần for holders of course.view', () => {
    const items = toMenuItems(APP_MENU, ['course.view']);
    const courses = items.find((item) => item.key === 'group:Học phần');
    expect(courses).toBeDefined();
    expect(
      'children' in courses! && courses.children.map((child) => child.key),
    ).toEqual([ROUTES.courses, ROUTES.equivalenceGroups]);
  });

  it('hides the whole group without course.view', () => {
    const keys = toMenuItems(APP_MENU, ['user.manage']).map((item) => item.key);
    expect(keys).not.toContain('group:Học phần');
    expect(keys).toContain(ROUTES.users);
  });

  it('selects the leaf of a child page and opens its group', () => {
    expect(selectedMenuPath(APP_MENU, '/courses/c1/edit')).toBe(ROUTES.courses);
    expect(selectedMenuPath(APP_MENU, ROUTES.equivalenceGroups)).toBe(
      ROUTES.equivalenceGroups,
    );
    expect(openMenuGroups(APP_MENU, ROUTES.equivalenceGroups)).toEqual([
      'group:Học phần',
    ]);
    expect(openMenuGroups(APP_MENU, ROUTES.users)).toEqual([]);
  });

  it('lists the programs for staff and hides them for a caller who only holds the student role', () => {
    const permissions = ['program.view' as const];
    expect(
      toMenuItems(APP_MENU, permissions, ['R2']).map((item) => item.key),
    ).toContain(ROUTES.programs);
    expect(
      toMenuItems(APP_MENU, permissions, ['R6']).map((item) => item.key),
    ).not.toContain(ROUTES.programs);
    // A student who also holds a staff role keeps the entry.
    expect(
      toMenuItems(APP_MENU, permissions, ['R6', 'R5']).map((item) => item.key),
    ).toContain(ROUTES.programs);
    expect(selectedMenuPath(APP_MENU, '/programs/p1/edit')).toBe(
      ROUTES.programs,
    );
  });

  it('shows the notifications to everyone and the approval queue only to holders of changeRequest.view', () => {
    const without = toMenuItems(APP_MENU, ['course.view']).map(
      (item) => item.key,
    );
    expect(without).toContain(ROUTES.notifications);
    expect(without).not.toContain(ROUTES.approvalQueue);
    const withView = toMenuItems(APP_MENU, ['changeRequest.view']).map(
      (item) => item.key,
    );
    expect(withView).toContain(ROUTES.approvalQueue);
    expect(withView).toContain(ROUTES.notifications);
  });

  it('lists the semesters only for holders of semester.manage', () => {
    const keys = (permissions: string[]) =>
      toMenuItems(APP_MENU, permissions as never).map((item) => item.key);
    expect(keys(['semester.manage'])).toContain(ROUTES.semesters);
    expect(keys(['course.view'])).not.toContain(ROUTES.semesters);
  });
});
