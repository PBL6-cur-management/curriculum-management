import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BACKUP_ERRORS, BackupFailure } from './backup.errors.js';
import {
  assertReferenceCoverage,
  copyFiles,
  evidenceOf,
  listFiles,
  sha256File,
  verifyTree,
} from './backup-files.js';

const signal = () => new AbortController().signal;
const SHA_OF_ABC =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'f26-files-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function put(relative: string, content: string) {
  const full = path.join(root, ...relative.split('/'));
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
  return full;
}

describe('sha256File / evidenceOf', () => {
  it('hashes bytes and records the size as a decimal string', async () => {
    const file = await put('a.txt', 'abc');
    expect(await sha256File(file)).toBe(SHA_OF_ABC);
    expect(await evidenceOf(file, 'a.txt')).toEqual({
      path: 'a.txt',
      sizeBytes: '3',
      sha256: SHA_OF_ABC,
    });
  });
});

describe('listFiles', () => {
  it('lists regular files with "/" separators, sorted, skipping in-flight .part uploads', async () => {
    await put('b/z.txt', '1');
    await put('a.txt', '1');
    await put('b/y.txt', '1');
    await put('c.pdf.part', '1');
    expect(await listFiles(root)).toEqual(['a.txt', 'b/y.txt', 'b/z.txt']);
  });

  it('refuses a root that holds an .env file', async () => {
    await put('.env', 'SECRET=1');
    await expect(listFiles(root)).rejects.toMatchObject({
      definition: BACKUP_ERRORS.ROOT_INVALID,
    });
  });

  it('refuses a symbolic link when the platform allows creating one', async () => {
    const target = await put('real.txt', 'x');
    try {
      await symlink(target, path.join(root, 'link.txt'));
    } catch {
      return; // creating links needs privileges on Windows; nothing to assert there
    }
    await expect(listFiles(root)).rejects.toBeInstanceOf(BackupFailure);
  });
});

describe('copyFiles / verifyTree', () => {
  it('copies every file and returns evidence that verifyTree accepts', async () => {
    await put('x/one.txt', 'abc');
    await put('two.txt', 'hello');
    const target = await mkdtemp(path.join(tmpdir(), 'f26-copy-'));
    try {
      const evidence = await copyFiles(root, target, signal());
      expect(evidence.map((e) => e.path)).toEqual(['two.txt', 'x/one.txt']);
      expect(evidence[1]).toMatchObject({ sizeBytes: '3', sha256: SHA_OF_ABC });
      expect(await verifyTree(target, evidence, signal())).toBe(true);
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  });

  it('verifyTree rejects a changed, missing or extra file', async () => {
    await put('one.txt', 'abc');
    const evidence = [await evidenceOf(path.join(root, 'one.txt'), 'one.txt')];
    expect(await verifyTree(root, evidence, signal())).toBe(true);

    await put('one.txt', 'abd');
    expect(await verifyTree(root, evidence, signal())).toBe(false);

    await put('one.txt', 'abc');
    await put('extra.txt', 'x');
    expect(await verifyTree(root, evidence, signal())).toBe(false);

    await rm(path.join(root, 'extra.txt'));
    await rm(path.join(root, 'one.txt'));
    expect(await verifyTree(root, evidence, signal())).toBe(false);
  });

  it('verifyTree is false, not a throw, when the folder does not exist', async () => {
    expect(await verifyTree(path.join(root, 'nope'), [], signal())).toBe(false);
  });

  it('stops when the operation is aborted', async () => {
    await put('one.txt', 'abc');
    const controller = new AbortController();
    controller.abort();
    await expect(
      copyFiles(root, path.join(root, 'out'), controller.signal),
    ).rejects.toThrow();
  });
});

describe('assertReferenceCoverage', () => {
  const file = { path: 'a/b.pdf', sizeBytes: '10', sha256: SHA_OF_ABC };
  const reference = {
    table: 'SyllabusAttachment' as const,
    id: '1',
    path: 'a/b.pdf',
    sizeBytes: '10',
  };

  it('accepts references that were copied at their recorded size, extra files allowed', () => {
    expect(() =>
      assertReferenceCoverage(
        [reference],
        [file, { ...file, path: 'extra' }],
      ),
    ).not.toThrow();
  });

  it('fails retryably when a referenced file is missing or has a different size', () => {
    for (const files of [[], [{ ...file, sizeBytes: '11' }]]) {
      try {
        assertReferenceCoverage([reference], files);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(BackupFailure);
        expect((error as BackupFailure).definition).toBe(
          BACKUP_ERRORS.FILE_MISSING,
        );
        expect((error as BackupFailure).retryable).toBe(true);
      }
    }
  });
});
