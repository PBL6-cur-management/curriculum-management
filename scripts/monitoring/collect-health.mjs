#!/usr/bin/env node
// F-27 BE-05. Supplementary evidence collector: polls GET <base-url>/api/health on an absolute minute grid and
// appends one JSON line per attempt. Built-ins only. Run it on a host other than the one being observed.
//
//   node collect-health.mjs --base-url https://ctdt.example.edu.vn --output D:\evidence\health.jsonl
//
// It never writes response bodies, headers or URLs with a query, and never turns a failed probe into an "up" sample.
import { appendFileSync } from 'node:fs';
import { HEARTBEAT_SECONDS, PROBE_TIMEOUT_MS } from './health-evidence.mjs';

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    const value = argv[i + 1];
    if (!name?.startsWith('--') || value === undefined)
      throw new Error(`Tùy chọn không hợp lệ gần: ${name ?? ''}`);
    options[name.slice(2)] = value;
  }
  return options;
}

export function healthUrl(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') throw new Error('--base-url phải là HTTPS.');
  if (url.pathname !== '/' || url.search || url.hash)
    throw new Error('--base-url chỉ gồm origin, không có đường dẫn hoặc query.');
  return new URL('/api/health', url).toString();
}

// One probe. Every failure mode becomes nullable fields, never a crash and never an UP sample.
export async function probe(url, fetchImpl = fetch) {
  const started = Date.now();
  const timestamp = new Date(started).toISOString();
  const sample = {
    timestamp,
    httpStatus: null,
    status: null,
    database: null,
    redis: null,
    elapsedMs: 0,
  };
  try {
    // Redirects are refused: a redirect to another origin would observe the wrong system.
    const response = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    sample.httpStatus = response.status;
    const body = await response.json();
    sample.status = body?.status === 'ok' || body?.status === 'error' ? body.status : null;
    sample.database = body?.database === 'up' || body?.database === 'down' ? body.database : null;
    sample.redis = body?.redis === 'up' || body?.redis === 'down' ? body.redis : null;
  } catch {
    // Timeout, network error or invalid JSON: keep whatever was read (usually just the status).
  }
  sample.elapsedMs = Date.now() - started;
  return sample;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options['base-url'] || !options.output)
    throw new Error('Cần --base-url và --output.');
  const url = healthUrl(options['base-url']);
  const output = options.output;
  const interval = HEARTBEAT_SECONDS * 1000;
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  // Absolute grid: the next attempt starts at the next whole minute, so a slow probe never shifts the schedule
  // and probes never overlap (each is awaited before the wait).
  while (!stopping) {
    const sample = await probe(url);
    appendFileSync(output, `${JSON.stringify(sample)}\n`);
    const wait = interval - (Date.now() % interval);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
}

const isEntry = process.argv[1]?.replace(/\\/g, '/').endsWith('collect-health.mjs');
if (isEntry) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
}
