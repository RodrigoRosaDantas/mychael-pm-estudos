import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const catalogUrl = new URL('content/catalog.json', root);
const manifestUrl = new URL('content/manifest.json', root);
const applicabilityUrl = new URL('content/content-applicability.json', root);

const applicabilityFiles = [
  'content/lots/lot-0012-0014-applicability.json',
  'content/lots/lot-0043-0046-applicability.json',
  'content/lots/lot-0047-applicability.json',
  'content/lots/lot-0048-applicability.json',
  'content/lots/lot-0049-applicability.json',
  'content/lots/lot-0050-applicability.json',
  'content/lots/lot-0051-applicability.json',
  'content/lots/lot-0052-applicability.json',
  'content/lots/lot-0053-applicability.json',
  'content/lots/lot-0054-applicability.json',
  'content/lots/lot-0055-applicability.json',
  'content/lots/lot-0056-applicability.json',
  'content/lots/lot-0057-applicability.json',
  'content/lots/lot-0058-applicability.json',
  'content/lots/lot-0059-applicability.json',
  'content/lots/lot-0060-applicability.json'
];

const fragmentFiles = [
  'content/lots/lot-0003.json',
  'content/lots/lot-0004-core.json',
  'content/lots/lot-0004-questions.json',
  'content/lots/lot-0005.json',
  'content/lots/lot-0006.json',
  'content/lots/lot-0007-subject.json',
  'content/lots/lot-0007.json',
  'content/lots/lot-0008.json',
  'content/lots/lot-0009-taxonomy.json',
  'content/lots/lot-0009.json',
  'content/lots/lot-0010.json',
  'content/lots/lot-0015.json',
  'content/lots/lot-0016.json',
  'content/lots/lot-0017.json',
  'content/lots/lot-0018.json',
  'content/lots/lot-0019.json',
  'content/lots/lot-0020.json',
  'content/lots/lot-0021.json',
  'content/lots/lot-0022.json',
  'content/lots/lot-0023.json',
  'content/lots/lot-0024.json',
  'content/lots/lot-0026.json',
  'content/lots/lot-0027.json',
  'content/lots/lot-0028.json',
  'content/lots/lot-0029.json',
  'content/lots/lot-0030.json',
  'content/lots/lot-0025.json',
  'content/lots/lot-0031.json',
  'content/lots/lot-0032.json',
  'content/lots/lot-0033.json',
  'content/lots/lot-0034.json',
  'content/lots/lot-0011.json',
  'content/lots/lot-0012.json',
  'content/lots/lot-0013.json',
  'content/lots/lot-0014.json',
  'content/lots/lot-0035.json',
  'content/lots/lot-0036.json',
  'content/lots/lot-0037.json',
  'content/lots/lot-0038.json',
  'content/lots/lot-0039.json',
  'content/lots/lot-0041.json',
  'content/lots/lot-0042.json',
  'content/lots/lot-0043.json',
  'content/lots/lot-0044.json',
  'content/lots/lot-0045.json',
  'content/lots/lot-0046.json',
  'content/lots/lot-0047.json',
  'content/lots/lot-0048-taxonomy.json',
  'content/lots/lot-0048.json',
  'content/lots/lot-0049.json',
  'content/lots/lot-0050-taxonomy.json',
  'content/lots/lot-0050.json',
  'content/lots/lot-0051-taxonomy.json',
  'content/lots/lot-0051.json',
  'content/lots/lot-0052-taxonomy.json',
  'content/lots/lot-0052.json',
  'content/lots/lot-0053-taxonomy.json',
  'content/lots/lot-0053.json',
  'content/lots/lot-0054-taxonomy.json',
  'content/lots/lot-0054.json',
  'content/lots/lot-0055.json',
  'content/lots/lot-0056-taxonomy.json',
  'content/lots/lot-0056.json',
  'content/lots/lot-0057-taxonomy.json',
  'content/lots/lot-0057.json',
  'content/lots/lot-0058-taxonomy.json',
  'content/lots/lot-0058.json',
  'content/lots/lot-0059-taxonomy.json',
  'content/lots/lot-0059.json',
  'content/lots/lot-0060-taxonomy.json',
  'content/lots/lot-0060.json'
];

const collections = ['subjects', 'topics', 'sources', 'units', 'materials', 'questions', 'questionSets'];
const readJson = (path) => readFile(new URL(path, root), 'utf8').then(JSON.parse);

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
  catalog.contentVersion = 59;
  catalog.generatedAt = '2026-08-12T06:27:00Z';
  catalog.publicationStatus = 'published';
  catalog.publication = {
    authorized: true,
    authorizedAt: '2026-08-12',
    lotId: 'LOT-0060',
    lotVersion: 1,
    source: 'Notion privado',
    recoveredLotIds: ['LOT-0012', 'LOT-0013', 'LOT-0014'],
    batchLotIds: ['LOT-0060']
  };
  return catalog;
}

function mergeApplicability(base, ...overlays) {
  const rules = [...(base.unitApplicability ?? [])];
  const byId = new Map(rules.map((rule, index) => [rule.unitId, index]));
  for (const overlay of overlays) {
    for (const rule of overlay.unitApplicability ?? []) {
      if (byId.has(rule.unitId)) rules[byId.get(rule.unitId)] = rule;
      else {
        byId.set(rule.unitId, rules.length);
        rules.push(rule);
      }
    }
  }
  return { ...base, reviewedAt: '2026-08-12', unitApplicability: rules };
}

const [baseCatalog, baseApplicability, applicabilityOverlays, fragments] = await Promise.all([
  readJson('content/catalog.json'),
  readJson('content/content-applicability.json'),
  Promise.all(applicabilityFiles.map(readJson)),
  Promise.all(fragmentFiles.map(readJson))
]);

const catalog = assembleCatalog(baseCatalog, fragments);
const applicability = mergeApplicability(baseApplicability, ...applicabilityOverlays);
const catalogBytes = Buffer.from(JSON.stringify(catalog));
const digest = createHash('sha256').update(catalogBytes).digest('hex');
const manifest = {
  schemaVersion: 1,
  generatedAt: catalog.generatedAt,
  contentVersion: catalog.contentVersion,
  files: [{ path: 'content/catalog.json', sha256: digest, bytes: catalogBytes.length }]
};

await writeFile(catalogUrl, catalogBytes);
await writeFile(applicabilityUrl, `${JSON.stringify(applicability, null, 2)}\n`);
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  status: 'assembled',
  contentVersion: catalog.contentVersion,
  units: catalog.units.length,
  materials: catalog.materials.length,
  questions: catalog.questions.length,
  questionSets: catalog.questionSets.length,
  recoveredLotIds: catalog.publication.recoveredLotIds,
  batchLotIds: catalog.publication.batchLotIds,
  sha256: digest
}));
