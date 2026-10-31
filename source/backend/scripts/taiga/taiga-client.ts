import { existsSync, readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

// Minimal Taiga REST client shared by the backlog scripts. Credentials come from TAIGA_USERNAME /
// TAIGA_PASSWORD / TAIGA_PROJECT_SLUG (env), falling back to the gitignored .mcp.json at the repo root.
// Nothing secret is printed.

export const REPO = new URL('../../../../', import.meta.url);
const REQUEST_GAP_MS = 400;
const THROTTLE_RETRIES = 20;

export interface TaigaConfig {
  api: string;
  username: string;
  password: string;
  slug: string;
}

export function credentials(): TaigaConfig {
  let env: Record<string, string> = {};
  const file = new URL('.mcp.json', REPO);
  if (existsSync(file))
    env =
      (
        JSON.parse(readFileSync(file, 'utf8')) as {
          mcpServers: { taiga?: { env?: Record<string, string> } };
        }
      ).mcpServers.taiga?.env ?? {};
  const pick = (key: string) => process.env[key] || env[key] || '';
  const value = {
    api:
      pick('TAIGA_API_URL').replace(/\/$/, '') || 'https://api.taiga.io/api/v1',
    username: pick('TAIGA_USERNAME'),
    password: pick('TAIGA_PASSWORD'),
    slug: pick('TAIGA_PROJECT_SLUG'),
  };
  for (const [key, v] of Object.entries(value))
    if (!v || v.startsWith('ĐIỀN'))
      throw new Error(`Taiga ${key} is not set (env or .mcp.json)`);
  return value;
}

export function createClient(config: TaigaConfig = credentials()) {
  let token = '';

  async function taiga<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      await delay(REQUEST_GAP_MS);
      const response = await fetch(`${config.api}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-disable-pagination': 'True',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      // Taiga throttles bursts and says how long to wait ("Expected available in N seconds").
      if (response.status === 429 && attempt < THROTTLE_RETRIES) {
        const seconds = Number(
          /available in (\d+) second/.exec(await response.text())?.[1] ?? 30,
        );
        console.log(`Throttled by Taiga; waiting ${seconds}s`);
        await delay((seconds + 5) * 1000);
        continue;
      }
      if (!response.ok)
        throw new Error(
          `Taiga ${method} ${path}: HTTP ${response.status} ${(await response.text()).slice(0, 300)}`,
        );
      return (response.status === 204 ? undefined : await response.json()) as T;
    }
  }

  async function login() {
    token = (
      await taiga<{ auth_token: string }>('POST', '/auth', {
        type: 'normal',
        username: config.username,
        password: config.password,
      })
    ).auth_token;
  }

  return { taiga, login, config };
}

export interface Named {
  id: number;
  name: string;
}

export interface TaggedItem {
  id: number;
  tags: [string, string | null][] | string[];
}

export const refOf = (item: TaggedItem) =>
  (item.tags as (string | [string, unknown])[])
    .map((tag) => (Array.isArray(tag) ? tag[0] : tag))
    .find((tag) => tag.startsWith('ref:'))
    ?.slice(4)
    .toUpperCase();
