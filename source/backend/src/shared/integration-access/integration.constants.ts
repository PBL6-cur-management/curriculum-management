export const INTEGRATION = {
  HEADER: 'x-api-key',
  KEY_PREFIX: 'ddut_',
  KEY_BYTES: 32,
  HASH_HEX_LENGTH: 64,
  DEFAULT_RATE_PER_MINUTE: 60,
  WINDOW_SECONDS: 60,
  MILLISECONDS_PER_SECOND: 1_000,
  CLIENT_NAME_MAX: 200,
  CODE_MAX: 100,
  MAX_POSTGRES_INT: 2_147_483_647,
  ABORTED_HTTP_STATUS: 499,
  OPENAPI_VERSION: '1.0.0',
  API_VERSION: 'v1',
  // Synthetic role code: never a database role, so no staff or student check ever matches it by accident.
  ROLE_CODE: 'INTEGRATION',
} as const;

export const INTEGRATION_RESOURCES = [
  'STUDENT_PROGRAM',
  'PROGRAM_VERSION',
  'SYLLABUS',
  'PROGRESS',
  'ELIGIBILITY',
  'GRADUATION',
] as const;
export type IntegrationResource = (typeof INTEGRATION_RESOURCES)[number];
