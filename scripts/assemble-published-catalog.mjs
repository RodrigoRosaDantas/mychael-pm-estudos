import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const catalogUrl = new URL('content/catalog.json', root);
const manifestUrl = new URL('content/manifest.json', root);
const applicabilityUrl = new URL('content/content-applicability.json', root);
const recoveredApplicabilityUrl = new URL('content/lots/lot-0012-0014-applicability.json', root);
const publicationApplicabilityUrl = new URL('content/lots/lot-0043-0046-applicability.json', root);
const lot0047ApplicabilityUrl = new URL('content/lots/lot-0047-applicability.json', root);
const lot0048ApplicabilityUrl = new URL('content/lots/lot-0048-applicability.json', root);
const lot0049ApplicabilityUrl = new URL('content/lots/lot-0049-applicability.json', root);
const lot0050ApplicabilityUrl = new URL('content/lots/lot-0050-applicability.json', root);
const lot0051ApplicabilityUrl = new URL('content/lots/lot-0051-applicability.json', root);
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
  new URL('content/lots/lot-0016.json', root),
  new URL('content/lots/lot-0017.json', root),
  new URL('content/lots/lot-0018.json', root),
  new URL('content/lots/lot-0019.json', root),
  new URL('content/lots/lot-0020.json', root),
  new URL('content/lots/lot-0021.json', root),
  new URL('content/lots/lot-0022.json', root),
  new URL('content/lots/lot-0023.json', root),
  new URL('content/lots/lot-0024.json', root),
  new URL('content/lots/lot-0026.json', root),
  new URL('content/lots/lot-0027.json', root),
  new URL('content/lots/lot-0028.json', root),
  new URL('content/lots/lot-0029.json', root),
  new URL('content/lots/lot-0030.json', root),
  new URL('content/lots/lot-0025.json', root),
  new URL('content/lots/lot-0031.json', root),
  new URL('content/lots/lot-0032.json', root),
  new URL('content/lots/lot-0033.json', root),
  new URL('content/lots/lot-0034.json', root),
  new URL('content/lots/lot-0011.json', root),
  new URL('content/lots/lot-0012.json', root),
  new URL('content/lots/lot-0013.json', root),
  new URL('content/lots/lot-0014.json', root),
  new URL('content/lots/lot-0035.json', root),
  new URL('content/lots/lot-0036.json', root),
  new URL('content/lots/lot-0037.json', root),
  new URL('content/lots/lot-0038.json', root),
  new URL('content/lots/lot-0039.json', root),
  new URL('content/lots/lot-0041.json', root),
  new URL('content/lots/lot-0042.json', root),
  new URL('content/lots/lot-0043.json', root),
  new URL('content/lots/lot-0044.json', root),
  new URL('content/lots/lot-0045.json', root),
  new URL('content/lots/lot-0046.json', root),
  new URL('content/lots/lot-0047.json', root),
  new URL('content/lots/lot-0048-taxonomy.json', root),
  new URL('content/lots/lot-0048.json', root),
  new URL('content/lots/lot-0049.json', root),
  new URL('content/lots/lot-0050-taxonomy.json', root),
  new URL('content/lots/lot-0050.json', root),
  new URL('content/lots/lot-0051-taxonomy.json', root),
  new URL('content/lots/lot-0051.json', root)
];
const collections = ['subjects', 'topics', 'sources', 'units', 'materials', 'questions', 'questionSets'];

function uniqueById(items) {
  const result = [];
  const positions = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    if (positions.has(item.id)) result[positions.get(item.id)] = item;
    else { positions.set(item.id, result.length); result.push(item); }
  }
  return result;
}

export function assembleCatalog(baseCatalog, fragments) {
  const catalog = structuredClone(baseCatalog);
  for (const collection of collections) {
    const additions = uniqueById(fragments.flatMap((fragment) => fragment[collection] ?? []));
    const additionIds = new Set(additions.map(({ id }) => id));
    catalog[collection] = [...(catalog[collection] ?? []).filter(({ id }) => !additionIds.has(id)), ...additions];
  }
  catalog.contentVersion = 50;
  catalog.generatedAt = '2026-08-11T20:35:00Z';
  catalog.publicationStatus = 'published';
  catalog.publication = {
    authorized: true,
    authorizedAt: '2026-08-11',
    lotId: 'LOT-0051',
    lotVersion: 1,
    source: 'Notion privado',
    recoveredLotIds: ['LOT-0012', 'LOT-0013', 'LOT-0014'],
    batchLotIds: ['LOT-0051']
  };
  return catalog;
}

function mergeApplicability(base, ...overlays) {
  const rules = [...(base.unitApplicability ?? [])];
  const byId = new Map(rules.map((rule, index) => [rule.unitId, index]));
  for (const overlay of overlays) {
    for (const rule of overlay.unitApplicability ?? []) {
      if (byId.has(rule.unitId)) rules[byId.get(rule.unitId)] = rule;
      else { byId.set(rule.unitId, rules.length); rules.push(rule); }
    }
  }
  return { ...base, reviewedAt: '2026-08-11', unitApplicability: rules };
}

const [baseCatalog, baseApplicability, recoveredApplicability, publicationApplicability, lot0047Applicability, lot0048Applicability, lot0049Applicability, lot0050Applicability, lot0051Applicability, ...fragments] = await Promise.all([
  readFile(catalogUrl, 'utf8').then(JSON.parse),
  readFile(applicabilityUrl, 'utf8').then(JSON.parse),
  readFile(recoveredApplicabilityUrl, 'utf8').then(JSON.parse),
  readFile(publicationApplicabilityUrl, 'utf8').then(JSON.parse),
  readFile(lot0047ApplicabilityUrl, 'utf8').then(JSON.parse),
  readFile(lot0048ApplicabilityUrl, 'utf8').then(JSON.parse),
  readFile(lot0049ApplicabilityUrl, 'utf8').then(JSON.parse),
  readFile(lot0050ApplicabilityUrl, 'utf8').then(JSON.parse),
  readFile(lot0051ApplicabilityUrl, 'utf8').then(JSON.parse),
  ...fragmentUrls.map((url) => readFile(url, 'utf8').then(JSON.parse))
]);
const catalog = assembleCatalog(baseCatalog, fragments);
const applicability = mergeApplicability(baseApplicability, recoveredApplicability, publicationApplicability, lot0047Applicability, lot0048Applicability, lot0049Applicability, lot0050Applicability, lot0051Applicability);
const catalogBytes = Buffer.from(JSON.stringify(catalog));
const digest = createHash('sha256').update(catalogBytes).digest('hex');
const manifest = { schemaVersion: 1, generatedAt: catalog.generatedAt, contentVersion: catalog.contentVersion, files: [{ path: 'content/catalog.json', sha256: digest, bytes: catalogBytes.length }] };
await writeFile(catalogUrl, catalogBytes);
await writeFile(applicabilityUrl, `${JSON.stringify(applicability, null, 2)}\n`);
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: 'assembled', contentVersion: catalog.contentVersion, units: catalog.units.length, materials: catalog.materials.length, questions: catalog.questions.length, questionSets: catalog.questionSets.length, recoveredLotIds: catalog.publication.recoveredLotIds, batchLotIds: catalog.publication.batchLotIds, sha256: digest }));
