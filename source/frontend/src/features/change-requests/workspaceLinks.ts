import { generatePath } from 'react-router';
import { ROUTES } from '../../routes';
import {
  REQUEST_ID_PARAM,
  TAB_PARAM,
} from '../../shared/change-requests/requestParams';
import type { ChangeRequestType, RequestWorkspace } from './api/changeRequests';

export interface WorkspaceLink {
  label: string;
  to: string;
}

export const SYLLABUS_CLO_TAB = 'clos';
export const SYLLABUS_FORMULA_TAB = 'formula';

// Where the creator edits a request's working copy: the existing screens, pointed at the copy.
export function workspaceLinks(
  type: ChangeRequestType,
  workspace: RequestWorkspace,
  requestId: string,
): WorkspaceLink[] {
  if (workspace.kind === 'SYLLABUS') {
    const base = generatePath(ROUTES.syllabusEdit, {
      courseId: workspace.courseId ?? '',
    });
    const query = new URLSearchParams({ [REQUEST_ID_PARAM]: requestId });
    if (type === 'OUTCOME') {
      query.set(TAB_PARAM, SYLLABUS_CLO_TAB);
      return [{ label: 'Sửa CLO của đề cương', to: `${base}?${query}` }];
    }
    if (type === 'GRADING_FORMULA') {
      query.set(TAB_PARAM, SYLLABUS_FORMULA_TAB);
      return [
        {
          label: 'Sửa công thức điểm và ánh xạ CLO',
          to: `${base}?${query}`,
        },
      ];
    }
    return [{ label: 'Sửa nội dung đề cương', to: `${base}?${query}` }];
  }
  const params = {
    programId: workspace.programId ?? '',
    versionId: workspace.copyId,
  };
  switch (type) {
    case 'CURRICULUM':
      return [
        {
          label: 'Sửa khung chương trình',
          to: generatePath(ROUTES.curriculum, params),
        },
        {
          label: 'Sửa nhóm tự chọn',
          to: generatePath(ROUTES.electiveGroups, params),
        },
      ];
    case 'PROGRAM_INFO':
      return [
        {
          label: 'Sửa thông tin chương trình',
          to: generatePath(ROUTES.programVersionInfo, params),
        },
      ];
    default:
      return [
        { label: 'Sửa PLO', to: generatePath(ROUTES.plos, params) },
        {
          label: 'Sửa ma trận học phần–PLO',
          to: generatePath(ROUTES.coursePloMatrix, params),
        },
        {
          label: 'Sửa ma trận CLO–PLO',
          to: generatePath(ROUTES.cloPloMatrix, params),
        },
      ];
  }
}
