import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content');
const names = (await readdir(contentDir)).filter((name) => name.endsWith('.json') && name !== 'manifest.json').sort();
const files = [];
for (const name of names) {
  const bytes = await readFile(path.join(contentDir, name));
  files.push({ path: `content/${name}`, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
}
const catalog = JSON.parse(await readFile(path.join(contentDir, 'catalog.json'), 'utf8'));
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  contentVersion: catalog.contentVersion,
  files
};
await writeFile(path.join(contentDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifesto gerado com ${files.length} arquivo(s).`);
