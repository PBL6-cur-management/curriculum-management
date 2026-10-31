import type { components, operations } from '../../../shared/api/schema';
import { getJson, sendJson, withQuery } from '../../../shared/api/client';

type Schemas = components['schemas'];
export type Delegation = Schemas['DelegationDto'];
export type DelegationPage = Schemas['DelegationPageDto'];
export type DelegationAccess = Schemas['DelegationAccessDto'];
export type DelegationStatus = Schemas['ApprovalDelegationStatus'];
export type DelegationUserOption = Schemas['DelegationUserOptionDto'];
export type DelegationLevel = Schemas['DelegationLevelDto'];
export type CreateDelegationInput = Schemas['CreateDelegationDto'];
export type DelegationQuery = NonNullable<
  operations['ApprovalDelegationsController_list']['parameters']['query']
>;

const BASE = '/approval-delegations';

export const fetchDelegationAccess = () =>
  getJson<DelegationAccess>(`${BASE}/access`);
export const fetchDelegations = (query: DelegationQuery) =>
  getJson<DelegationPage>(withQuery(BASE, { ...query }));
export const fetchRecipients = (q: string) =>
  getJson<DelegationUserOption[]>(withQuery(`${BASE}/recipients`, { q }));
export const fetchDelegators = (q: string) =>
  getJson<DelegationUserOption[]>(withQuery(`${BASE}/delegators`, { q }));
export const fetchDelegationLevels = (delegatorId?: string) =>
  getJson<DelegationLevel[]>(withQuery(`${BASE}/levels`, { delegatorId }));
export const createDelegation = (input: CreateDelegationInput) =>
  sendJson<Delegation>('POST', BASE, input);
export const revokeDelegation = (id: string) =>
  sendJson<Delegation>('POST', `${BASE}/${encodeURIComponent(id)}/revoke`, {});
