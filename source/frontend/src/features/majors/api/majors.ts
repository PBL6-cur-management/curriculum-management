import { getJson, sendJson, withQuery } from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

export type MajorStatus = components['schemas']['MajorStatus'];
export type MajorItem = components['schemas']['MajorDto'];
export type MajorPage = components['schemas']['MajorPageDto'];
export type CreateMajorRequest = components['schemas']['CreateMajorDto'];
export type UpdateMajorRequest = components['schemas']['UpdateMajorDto'];
export type MajorQuery = NonNullable<
  operations['MajorsController_list']['parameters']['query']
>;

export const MAJORS_PATH = '/majors';

export const fetchMajors = (query: MajorQuery) =>
  getJson<MajorPage>(withQuery(MAJORS_PATH, { ...query }));

export const createMajor = (body: CreateMajorRequest) =>
  sendJson<MajorItem>('POST', MAJORS_PATH, body);

export const updateMajor = (majorId: string, body: UpdateMajorRequest) =>
  sendJson<MajorItem>(
    'PATCH',
    `${MAJORS_PATH}/${encodeURIComponent(majorId)}`,
    body,
  );

export const setMajorStatus = (majorId: string, status: MajorStatus) =>
  sendJson<MajorItem>(
    'PATCH',
    `${MAJORS_PATH}/${encodeURIComponent(majorId)}/status`,
    { status },
  );
