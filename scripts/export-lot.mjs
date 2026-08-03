import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildCatalog, buildManifest } from './lot-exporter.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const inputPath = option('--input');
const outDir = option('--out');
const allowBlocked = process.argv.includes('--allow-blocked');

if (!inputPath || !outDir) {
  console.error('Uso: node scripts/export-lot.mjs --input <snapshot.json> --out <diretório> [--allow-blocked]');
  process.exit(64);
}

const snapshot = JSON.parse(await readFile(path.resolve(inputPath), 'utf8'));
const manifest = buildManifest(snapshot);
await mkdir(path.resolve(outDir), { recursive: true });
await writeFile(path.resolve(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

if (manifest.status === 'blocked') {
  console.error(`Manifesto gerado, mas o lote está bloqueado:\n- ${manifest.blockers.join('\n- ')}`);
  if (!allowBlocked) process.exitCode = 2;
} else {
  const catalog = buildCatalog(snapshot);
  await writeFile(path.resolve(outDir, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Lote ${manifest.lotId} exportado com ${manifest.recordCount} registros.`);
}
