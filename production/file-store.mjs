// Server-side durable storage. Keep this directory outside public web output.
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
export function fileStore(directory) {
  const root = resolve(directory);
  const pathFor = key => join(root, createHash('sha256').update(String(key)).digest('hex') + '.json');
  return {
    async load(key) {
      try { return JSON.parse(await readFile(pathFor(key), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
    },
    async save(key, value) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const target = pathFor(key), temporary = target + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
        await rename(temporary, target);
      } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    }
  };
}
