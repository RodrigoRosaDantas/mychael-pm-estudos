import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const catalogUrl = new URL('content/catalog.json', root);
const manifestUrl = new URL('content/manifest.json', root);
const fragmentUrls = [
  new URL('content/lots/lot-0003.json', root),
  new URL('content/lots/lot-0004-core.json', root),
  new URL('content/lots/lot-0004-questions.json', root),
  new URL('content/lots/lot-0005.json', root),
  new URL('content/lots/lot-0006.json', root),
  new URL('content/lots/lot-0007-subject.json', root),
  new URL('content/lots/lot-0007.json', root),
  new URL('content/lots/lot-0008.json', root),
  new URL('content/lots/lot-0009-taxonomy.json', root),
  new URL('content/lots/lot-0009.json', root),
  new URL('content/lots/lot-0010.json', root),
  new URL('content/lots/lot-0015.json', root),
  new URL('content/lots/lot-0016.json', root)
];
const collections = ['subjects', 'topics', 'sources', 'units', 'materials', 'questions', 'questionSets'];

function uniqueById(items) {
  const result = [];
  const positions = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    if (positions.has(item.id)) result[positions.get(item.id)] = item;
    else {
      positions.set(item.id, result.length);
      result.push(item);
    }
  }
  return result;
}

export function assembleCatalog(baseCatalog, fragments) {
  const catalog = structuredClone(baseCatalog);
  for (const collection of collections) {
    const additions = uniqueById(fragments.flatMap((fragment) => fragment[collection] ?? []));
    const additionIds = new Set(additions.map(({ id }) => id));
    catalog[collection] = [
      ...(catalog[collection] ?? []).filter(({ id }) => !additionIds.has(id)),
      ...additions
    ];
  }
  catalog.contentVersion = 12;
  catalog.generatedAt = '2026-08-07T11:32:00Z';
  catalog.publicationStatus = 'published';
  catalog.publication = {
    authorized: true,
    authorizedAt: '2026-08-07',
    lotId: 'LOT-0016',
    lotVersion: 1,
    source: 'Notion privado'
  };
  return catalog;
}

const [baseCatalog, ...fragments] = await Promise.all([
  readFile(catalogUrl, 'utf8').then(JSON.parse),
  ...fragmentUrls.map((url) => readFile(url, 'utf8').then(JSON.parse))
]);
const catalog = assembleCatalog(baseCatalog, fragments);
const catalogBytes = Buffer.from(JSON.stringify(catalog));
const digest = createHash('sha256').update(catalogBytes).digest('hex');
const manifest = {
  schemaVersion: 1,
  generatedAt: catalog.generatedAt,
  contentVersion: catalog.contentVersion,
  files: [{ path: 'content/catalog.json', sha256: digest, bytes: catalogBytes.length }]
};
await writeFile(catalogUrl, catalogBytes);
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  status: 'assembled',
  contentVersion: catalog.contentVersion,
  units: catalog.units.length,
  materials: catalog.materials.length,
  questions: catalog.questions.length,
  questionSets: catalog.questionSets.length,
  sha256: digest
}));
