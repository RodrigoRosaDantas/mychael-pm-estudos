import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const lot = JSON.parse(await readFile(new URL('../content/lots/lot-0050.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000427','Q000428','Q000429','Q000430','Q000431','Q000432','Q000433'];
const answers = ['B','C','A','D','E','C','D'];

test('LOT-0050 monta catálogo v49 sem reduzir validações', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(lot.lotId, 'LOT-0050');
  assert.equal(lot.contentVersion, 49);
  assert.equal(catalog.contentVersion, 49);
  assert.equal(catalog.publication.lotId, 'LOT-0050');
  assert.equal(catalog.units.length, 49);
  assert.equal(catalog.materials.length, 49);
  assert.equal(catalog.questions.length, 336);
  assert.equal(catalog.questionSets.length, 49);
});

test('U049 preserva fontes e separação teoria/questões', () => {
  const unit = find(catalog.units, 'U049');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMGO']); assert.deepEqual(unit.materialIds, ['M049']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS049']); assert.deepEqual(unit.sourceIds, ['FNT-0003','FNT-0015','FNT-0014']);
  const material = find(catalog.materials, 'M049');
  assert.ok(material); assert.equal(material.unitId, 'U049'); assert.equal(material.type, 'Aula teórica'); assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  ids.forEach((id, index) => {
    const q = find(catalog.questions, id);
    assert.ok(q, id); assert.equal(q.unitId, 'U049', id); assert.equal(q.answer, answers[index], id); assert.equal(q.options.length, 5, id); assert.ok(q.options.some((o) => o.id === answers[index]), id); assert.deepEqual(q.sourceIds, ['FNT-0003'], id); assert.ok(q.commentary.length > 20, id); assert.ok(q.foundation.length > 10, id); assert.equal(q.annulled, false, id); assert.equal(q.duplicateOf, null, id); assert.equal(q.imageRequired, false, id); assert.equal(q.valid, true, id);
  });
  const set = find(catalog.questionSets, 'QS049');
  assert.ok(set); assert.equal(set.unitId, 'U049'); assert.deepEqual(set.questionIds, ids); assert.equal(set.correctionMode, 'Ao finalizar'); assert.equal('questions' in set, false); assert.equal('answers' in set, false);
});

test('U049 tem aplicabilidade explícita PMDF + PMGO sem ativar PMMG', () => {
  const rule = applicability.unitApplicability.find((item) => item.unitId === 'U049');
  assert.ok(rule); assert.equal(rule.classification, 'shared-2'); assert.deepEqual(rule.competitions, ['PMDF','PMGO']); assert.deepEqual(rule.evidenceIds, ['FNT-0015','FNT-0014','FNT-0003']);
  assert.equal(applicability.specificRotation.enabled, false);
});
