import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const lot = JSON.parse(await readFile(new URL('../content/lots/lot-0061.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000504','Q000505','Q000506','Q000507','Q000508','Q000509','Q000510'];
const answers = ['B','C','D','A','E','C','D'];

test('LOT-0061 monta catálogo v60 sem reduzir validações', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(lot.lotId, 'LOT-0061');
  assert.equal(lot.contentVersion, 60);
  assert.equal(catalog.contentVersion, 60);
  assert.equal(catalog.publication.lotId, 'LOT-0061');
  assert.equal(catalog.units.length, 60);
  assert.equal(catalog.materials.length, 60);
  assert.equal(catalog.questions.length, 413);
  assert.equal(catalog.questionSets.length, 60);
  assert.ok(find(catalog.topics, 'ASS-PPM-003'));
  assert.ok(find(catalog.topics, 'ASS-PPM-003-01'));
});

test('U060 preserva fonte normativa e separação teoria/questões', () => {
  const unit = find(catalog.units, 'U060');
  assert.ok(unit);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO']);
  assert.deepEqual(unit.materialIds, ['M060']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS060']);
  assert.deepEqual(unit.sourceIds, ['FNT-0005']);

  const material = find(catalog.materials, 'M060');
  assert.ok(material);
  assert.equal(material.unitId, 'U060');
  assert.equal(material.type, 'Aula teórica');
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  assert.equal('options' in material, false);

  ids.forEach((id, index) => {
    const q = find(catalog.questions, id);
    assert.ok(q, id);
    assert.equal(q.unitId, 'U060', id);
    assert.equal(q.answer, answers[index], id);
    assert.equal(q.options.length, 5, id);
    assert.ok(q.options.some((o) => o.id === answers[index]), id);
    assert.deepEqual(q.sourceIds, ['FNT-0005'], id);
    assert.ok(q.commentary.length > 20, id);
    assert.ok(q.foundation.length > 10, id);
    assert.equal(q.annulled, false, id);
    assert.equal(q.duplicateOf, null, id);
    assert.equal(q.imageRequired, false, id);
    assert.equal(q.valid, true, id);
  });

  const set = find(catalog.questionSets, 'QS060');
  assert.ok(set);
  assert.equal(set.unitId, 'U060');
  assert.deepEqual(set.questionIds, ids);
  assert.equal(set.correctionMode, 'Por questão');
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});

test('U060 tem aplicabilidade explícita PMDF + PMGO sem ativar rotação específica', () => {
  const rule = applicability.unitApplicability.find((item) => item.unitId === 'U060');
  assert.ok(rule);
  assert.equal(rule.classification, 'shared-2');
  assert.deepEqual(rule.competitions, ['PMDF','PMGO']);
  assert.deepEqual(rule.evidenceIds, ['FNT-0015','FNT-0014']);
  assert.equal(applicability.specificRotation.enabled, false);
});
