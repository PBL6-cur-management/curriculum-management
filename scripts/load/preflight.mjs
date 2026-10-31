#!/usr/bin/env node
// F-27 BE-07. Fail-closed gate before k6: validates the manifest and credentials and the target URL.
//   node preflight.mjs --profile canonical --manifest m.json --credentials c.json --base-url https://host
import { readFileSync } from 'node:fs';
import { validateCredentials, validateManifest } from './manifest.mjs';
import { PROFILES } from './workload.mjs';

export function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const name = argv[i];
    if (!name?.startsWith('--') || argv[i + 1] === undefined)
      throw new Error(`Tùy chọn không hợp lệ gần: ${name ?? ''}`);
    options[name.slice(2)] = argv[i + 1];
  }
  return options;
}

export function runPreflight(options, read = (p) => readFileSync(p, 'utf8')) {
  const { profile, manifest, credentials, 'base-url': baseUrl } = options;
  if (!PROFILES.includes(profile)) throw new Error('--profile phải là canonical hoặc staff-smoke.');
  if (!manifest || !credentials || !baseUrl)
    throw new Error('Cần --manifest, --credentials và --base-url.');
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') throw new Error('--base-url phải là HTTPS.');
  const parsed = validateManifest(JSON.parse(read(manifest)), profile);
  validateCredentials(JSON.parse(read(credentials)), parsed);
  return { profile, students: parsed.students.length, staff: parsed.staff.length };
}

const isEntry = process.argv[1]?.replace(/\\/g, '/').endsWith('preflight.mjs');
if (isEntry) {
  try {
    console.log(JSON.stringify(runPreflight(parseArgs(process.argv.slice(2)))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
