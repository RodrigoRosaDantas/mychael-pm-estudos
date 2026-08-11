import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const lot = JSON.parse(await readFile(new URL('../content/lots/lot-0048.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000413','Q000414','Q000415','Q000416','Q000417','Q000418','Q000419'];
const answers = ['B','D','C','B','E','C','D'];

test('LOT-0048 permanece íntegro no catálogo cumulativo v50', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(lot.lotId, 'LOT-0048');
  assert.equal(lot.contentVersion, 47);
  assert.equal(catalog.contentVersion, 50);
  assert.equal(catalog.publication.lotId, 'LOT-0051');
  assert.equal(catalog.units.length, 50);
  assert.equal(catalog.materials.length, 50);
  assert.equal(catalog.questions.length, 343);
  assert.equal(catalog.questionSets.length, 50);
});

test('U047 preserva taxonomia, fontes e separação teoria/questões', () => {
  assert.ok(find(catalog.topics, 'ASS-MAT-003'));
  assert.ok(find(catalog.topics, 'ASS-MAT-003-03'));
  const unit = find(catalog.units, 'U047');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMMG']); assert.deepEqual(unit.materialIds, ['M047']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS047']); assert.deepEqual(unit.sourceIds, ['FNT-0015','FNT-0025','FNT-0026']);
  const material = find(catalog.materials, 'M047');
  assert.ok(material); assert.equal(material.unitId, 'U047'); assert.equal(material.type, 'Aula teórica'); assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  ids.forEach((id, index) => { const q = find(catalog.questions, id); assert.ok(q, id); assert.equal(q.unitId, 'U047', id); assert.equal(q.answer, answers[index], id); assert.equal(q.options.length, 5, id); assert.ok(q.options.some((o) => o.id === answers[index]), id); assert.deepEqual(q.sourceIds, ['FNT-0015','FNT-0025','FNT-0026'], id); assert.ok(q.commentary.length > 20, id); assert.ok(q.foundation.length > 20, id); assert.equal(q.annulled, false, id); assert.equal(q.duplicateOf, null, id); assert.equal(q.imageRequired, false, id); assert.equal(q.valid, true, id); });
  const set = find(catalog.questionSets, 'QS047'); assert.ok(set); assert.equal(set.unitId, 'U047'); assert.deepEqual(set.questionIds, ids); assert.equal(set.correctionMode, 'Ao finalizar'); assert.equal('questions' in set, false); assert.equal('answers' in set, false);
});

test('U047 tem aplicabilidade explícita PMDF + PMMG sem ativar PMGO', () => {
  const rule = applicability.unitApplicability.find((item) => item.unitId === 'U047'); assert.ok(rule); assert.equal(rule.classification, 'shared-2'); assert.deepEqual(rule.competitions, ['PMDF','PMMG']); assert.deepEqual(rule.evidenceIds, ['FNT-0015','FNT-0025','FNT-0026']); assert.equal(applicability.specificRotation.enabled, false);
});
