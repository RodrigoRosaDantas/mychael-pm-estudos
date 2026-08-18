import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const lot = JSON.parse(await readFile(new URL('../content/lots/lot-0063.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000518','Q000519','Q000520','Q000521','Q000522','Q000523','Q000524'];
const answers = ['C','A','D','B','E','D','A'];

test('LOT-0063 monta catálogo cumulativo v62 sem reduzir validações', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(lot.lotId, 'LOT-0063');
  assert.equal(lot.contentVersion, 62);
  assert.equal(catalog.contentVersion, 62);
  assert.equal(catalog.publication.lotId, 'LOT-0063');
  assert.equal(catalog.units.length, 62);
  assert.equal(catalog.materials.length, 62);
  assert.equal(catalog.questions.length, 427);
  assert.equal(catalog.questionSets.length, 62);
});

test('U062 preserva taxonomia, fontes e separação teoria/questões', () => {
  assert.ok(find(catalog.topics, 'ASS-ING-001'));
  assert.ok(find(catalog.topics, 'ASS-ING-001-01'));
  const unit = find(catalog.units, 'U062');
  assert.ok(unit);
  assert.deepEqual(unit.coverage, ['PMDF','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-ING-001','ASS-ING-001-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0015','FNT-0025','FNT-0026']);
  assert.deepEqual(unit.materialIds, ['M062']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS062']);

  const material = find(catalog.materials, 'M062');
  assert.ok(material);
  assert.equal(material.unitId, 'U062');
  assert.equal(material.type, 'Aula teórica');
  assert.deepEqual(material.sourceIds, ['FNT-0015','FNT-0025','FNT-0026']);
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  assert.equal('options' in material, false);

  ids.forEach((id, index) => {
    const q = find(catalog.questions, id);
    assert.ok(q, id);
    assert.equal(q.unitId, 'U062', id);
    assert.equal(q.subjectId, 'MAT-ING', id);
    assert.deepEqual(q.topicIds, ['ASS-ING-001-01'], id);
    assert.equal(q.answer, answers[index], id);
    assert.equal(q.options.length, 5, id);
    assert.ok(q.options.some((option) => option.id === answers[index]), id);
    assert.deepEqual(q.sourceIds, ['FNT-0015','FNT-0025','FNT-0026'], id);
    assert.ok(q.commentary.length > 20, id);
    assert.ok(q.foundation.length > 20, id);
    assert.equal(q.annulled, false, id);
    assert.equal(q.duplicateOf, null, id);
    assert.equal(q.imageRequired, false, id);
    assert.equal(q.valid, true, id);
  });

  const set = find(catalog.questionSets, 'QS062');
  assert.ok(set);
  assert.equal(set.unitId, 'U062');
  assert.deepEqual(set.questionIds, ids);
  assert.equal(set.correctionMode, 'Por questão');
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});

test('U062 tem aplicabilidade explícita PMDF + PMMG sem ativar rotação específica', () => {
  const rule = applicability.unitApplicability.find((item) => item.unitId === 'U062');
  assert.ok(rule);
  assert.equal(rule.classification, 'shared-2');
  assert.deepEqual(rule.competitions, ['PMDF','PMMG']);
  assert.deepEqual(rule.evidenceIds, ['FNT-0015','FNT-0025','FNT-0026']);
  assert.equal(applicability.specificRotation.enabled, false);
});
