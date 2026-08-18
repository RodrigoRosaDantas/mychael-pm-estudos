import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const lot = JSON.parse(await readFile(new URL('../content/lots/lot-0059.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000490','Q000491','Q000492','Q000493','Q000494','Q000495','Q000496'];
const answers = ['C','B','A','D','E','C','D'];

test('LOT-0059 permanece íntegro no catálogo v62 sem reduzir validações', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(lot.lotId, 'LOT-0059');
  assert.equal(lot.contentVersion, 58);
  assert.equal(catalog.contentVersion, 62);
  assert.equal(catalog.publication.lotId, 'LOT-0063');
  assert.equal(catalog.units.length, 62);
  assert.equal(catalog.materials.length, 62);
  assert.equal(catalog.questions.length, 427);
  assert.equal(catalog.questionSets.length, 62);
  assert.ok(find(catalog.topics, 'ASS-PPEN-006'));
  assert.ok(find(catalog.topics, 'ASS-PPEN-006-01'));
});

test('U058 preserva fontes e separação teoria/questões', () => {
  const unit = find(catalog.units, 'U058');
  assert.ok(unit);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO']);
  assert.deepEqual(unit.materialIds, ['M058']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS058']);
  assert.deepEqual(unit.sourceIds, ['FNT-0003']);
  const material = find(catalog.materials, 'M058');
  assert.ok(material);
  assert.equal(material.unitId, 'U058');
  assert.equal(material.type, 'Aula teórica');
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  assert.equal('options' in material, false);
  ids.forEach((id, index) => {
    const q = find(catalog.questions, id);
    assert.ok(q, id);
    assert.equal(q.unitId, 'U058', id);
    assert.equal(q.answer, answers[index], id);
    assert.equal(q.options.length, 5, id);
    assert.ok(q.options.some((o) => o.id === answers[index]), id);
    assert.deepEqual(q.sourceIds, ['FNT-0003'], id);
    assert.ok(q.commentary.length > 20, id);
    assert.ok(q.foundation.length > 10, id);
    assert.equal(q.annulled, false, id);
    assert.equal(q.duplicateOf, null, id);
    assert.equal(q.imageRequired, false, id);
    assert.equal(q.valid, true, id);
  });
  const set = find(catalog.questionSets, 'QS058');
  assert.ok(set);
  assert.equal(set.unitId, 'U058');
  assert.deepEqual(set.questionIds, ids);
  assert.equal(set.correctionMode, 'Por questão');
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});

test('U058 tem aplicabilidade explícita PMDF + PMGO sem ativar rotação específica', () => {
  const rule = applicability.unitApplicability.find((item) => item.unitId === 'U058');
  assert.ok(rule);
  assert.equal(rule.classification, 'shared-2');
  assert.deepEqual(rule.competitions, ['PMDF','PMGO']);
  assert.deepEqual(rule.evidenceIds, ['FNT-0015','FNT-0014','FNT-0003']);
  assert.equal(applicability.specificRotation.enabled, false);
});
