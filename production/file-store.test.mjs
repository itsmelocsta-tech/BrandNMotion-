import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileStore } from './file-store.mjs';
test('recovers production state after recreating store and confines arbitrary IDs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bnm-store-'));
  try {
    const key = '../../outside';
    assert.equal(await fileStore(dir).load(key), undefined);
    await fileStore(dir).save(key, { shots: [{ status: 'complete', url: 'test.mp4' }] });
    assert.equal((await fileStore(dir).load(key)).shots[0].status, 'complete');
    const files = await readdir(dir);
    assert.equal(files.length, 1);
    await writeFile(join(dir, files[0]), 'broken');
    await assert.rejects(fileStore(dir).load(key), SyntaxError);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
