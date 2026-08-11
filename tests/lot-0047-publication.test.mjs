import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const lot = JSON.parse(await readFile(new URL('../content/lots/lot-0047.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000406','Q000407','Q000408','Q000409','Q000410','Q000411','Q000412'];
const answers = ['C','D','A','E','B','C','D'];

test('LOT-0047 permanece íntegro no catálogo cumulativo v48', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(lot.lotId, 'LOT-0047');
  assert.equal(lot.contentVersion, 46);
  assert.equal(catalog.contentVersion, 48);
  assert.equal(catalog.publication.lotId, 'LOT-0049');
  assert.equal(catalog.units.length, 48);
  assert.equal(catalog.materials.length, 48);
  assert.equal(catalog.questions.length, 329);
  assert.equal(catalog.questionSets.length, 48);
});

test('U046 preserva fonte normativa vigente e separação teoria/questões', () => {
  const source = find(catalog.sources, 'FNT-0027');
  assert.ok(source); assert.equal(source.official, true); assert.equal(source.temporalStatus, 'Vigente'); assert.equal(source.lastVerifiedAt, '2026-08-11');
  const unit = find(catalog.units, 'U046');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMGO']); assert.deepEqual(unit.materialIds, ['M046']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS046']); assert.deepEqual(unit.sourceIds, ['FNT-0027','FNT-0015','FNT-0014']);
  const material = find(catalog.materials, 'M046');
  assert.ok(material); assert.equal(material.unitId, 'U046'); assert.equal(material.type, 'Aula teórica'); assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  ids.forEach((id, index) => { const q = find(catalog.questions, id); assert.ok(q, id); assert.equal(q.unitId, 'U046', id); assert.equal(q.answer, answers[index], id); assert.equal(q.options.length, 5, id); assert.ok(q.options.some((o) => o.id === answers[index]), id); assert.deepEqual(q.sourceIds, ['FNT-0027'], id); assert.ok(q.commentary.length > 20, id); assert.ok(q.foundation.length > 20, id); assert.equal(q.annulled, false, id); assert.equal(q.duplicateOf, null, id); assert.equal(q.imageRequired, false, id); assert.equal(q.valid, true, id); });
  const set = find(catalog.questionSets, 'QS046'); assert.ok(set); assert.equal(set.unitId, 'U046'); assert.deepEqual(set.questionIds, ids); assert.equal(set.correctionMode, 'Ao finalizar'); assert.equal('questions' in set, false); assert.equal('answers' in set, false);
});

test('U046 tem aplicabilidade explícita PMDF + PMGO sem ativar PMMG', () => {
  const rule = applicability.unitApplicability.find((item) => item.unitId === 'U046'); assert.ok(rule); assert.equal(rule.classification, 'shared-2'); assert.deepEqual(rule.competitions, ['PMDF','PMGO']); assert.equal(rule.status, 'verified-not-pmmg'); assert.deepEqual(rule.evidenceIds, ['FNT-0015','FNT-0014','FNT-0027']); assert.equal(applicability.specificRotation.enabled, false);
});
