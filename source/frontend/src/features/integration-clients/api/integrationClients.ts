import { getJson, sendJson, withQuery } from '../../../shared/api/client';
import type { components, operations } from '../../../shared/api/schema';

export type IntegrationClient = components['schemas']['IntegrationClientDto'];
export type IntegrationClientPage =
  components['schemas']['IntegrationClientPageDto'];
export type IssuedIntegrationClient =
  components['schemas']['IssuedIntegrationClientDto'];
export type IntegrationClientStatus =
  components['schemas']['IntegrationClientStatus'];
export type CreateIntegrationClient =
  components['schemas']['CreateIntegrationClientDto'];
export type UpdateIntegrationClient =
  components['schemas']['UpdateIntegrationClientDto'];
export type IntegrationClientQuery = NonNullable<
  operations['IntegrationClientsController_list']['parameters']['query']
>;

const BASE = '/integration-clients';
const clientPath = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

export const fetchIntegrationClients = (query: IntegrationClientQuery) =>
  getJson<IntegrationClientPage>(withQuery(BASE, query));
export const createIntegrationClient = (body: CreateIntegrationClient) =>
  sendJson<IssuedIntegrationClient>('POST', BASE, body);
export const updateIntegrationClient = (
  id: string,
  body: UpdateIntegrationClient,
) => sendJson<IntegrationClient>('PATCH', clientPath(id), body);
export const setIntegrationClientLocked = (id: string, locked: boolean) =>
  sendJson<IntegrationClient>(
    'POST',
    `${clientPath(id)}/${locked ? 'lock' : 'unlock'}`,
  );

// The partner's contract lives beside the API, not in this app; no key is ever put in the link.
export const DDUT_DOCS_URL = '/api/v1/docs';
