import {
  ChangeRequestStatus,
  ChangeRequestType,
} from '../../generated/prisma/client.js';

export const CHANGE_REQUEST_LIMITS = {
  TITLE_MAX: 200,
  REASON_MAX: 4000,
  BASIS_NUMBER_MAX: 100,
  AUTHORED_ITEMS_MAX: 100,
  DOCUMENTS_MAX: 20,
  USER_OPTIONS_MAX: 20,
  QUERY_MAX: 100,
  COURSE_NAME_MAX: 200,
} as const;

export const REQUEST_CODE = { PREFIX: 'DX', DIGITS: 4 } as const;

export const CREATABLE_TYPES: readonly ChangeRequestType[] =
  Object.values(ChangeRequestType);

export const DOCUMENT_DIR = 'change-requests';

// A document can be added while the request is a Draft or waiting for approval.
export const UPLOAD_STATUSES: readonly ChangeRequestStatus[] = [
  ChangeRequestStatus.DRAFT,
  ChangeRequestStatus.PENDING_COORDINATOR,
  ChangeRequestStatus.PENDING_DIRECTOR,
  ChangeRequestStatus.PENDING_ACADEMIC_OFFICE,
];
