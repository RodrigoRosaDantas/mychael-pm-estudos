import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);

function assertQuestion(id, unitId, answer, topicIds, sourceIds) {
  const q = find(catalog.questions, id);
  assert.ok(q, id);
  assert.equal(q.unitId, unitId, id);
  assert.equal(q.subjectId, 'MAT-PORT', id);
  assert.equal(q.answer, answer, id);
  assert.deepEqual(q.topicIds, topicIds, id);
  assert.deepEqual(q.sourceIds, sourceIds, id);
  assert.equal(q.options.length, 5, id);
  assert.ok(q.options.some((option) => option.id === answer), id);
  assert.ok(q.commentary.length > 20, id);
  assert.ok(q.foundation.length > 10, id);
  assert.equal(q.annulled, false, id);
  assert.equal(q.duplicateOf, null, id);
  assert.equal(q.imageRequired, false, id);
  assert.equal(q.valid, true, id);
}

test('catálogo v16 integra LOT-0020 e LOT-0021 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 16);
  assert.equal(catalog.publication.lotId, 'LOT-0021');
  assert.equal(catalog.units.length, 16);
  assert.equal(catalog.materials.length, 16);
  assert.equal(catalog.questions.length, 105);
  assert.equal(catalog.questionSets.length, 16);
});

test('U020 preserva teoria separada e sete questões auditadas', () => {
  const ids = ['Q000127','Q000128','Q000129','Q000130','Q000131','Q000132','Q000133'];
  const unit = find(catalog.units, 'U020');
  assert.deepEqual(unit.materialIds, ['M020']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS020']);
  assert.deepEqual(unit.sourceIds, ['FNT-0028']);
  const material = find(catalog.materials, 'M020');
  assert.equal(material.unitId, 'U020');
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  const answers = ['A','C','B','E','D','A','C'];
  ids.forEach((id, index) => assertQuestion(id, 'U020', answers[index], catalog.questions.find((q) => q.id === id).topicIds, ['FNT-0028']));
  const set = find(catalog.questionSets, 'QS020');
  assert.deepEqual(set.questionIds, ids);
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});

test('U021 preserva teoria separada e sete questões auditadas', () => {
  const ids = ['Q000134','Q000135','Q000136','Q000137','Q000138','Q000139','Q000140'];
  const unit = find(catalog.units, 'U021');
  assert.deepEqual(unit.materialIds, ['M021']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS021']);
  assert.deepEqual(unit.sourceIds, ['FNT-0029','FNT-0028']);
  const material = find(catalog.materials, 'M021');
  assert.equal(material.unitId, 'U021');
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  const answers = ['B','D','A','C','E','B','D'];
  ids.forEach((id, index) => {
    const q = find(catalog.questions, id);
    assertQuestion(id, 'U021', answers[index], q.topicIds, q.sourceIds);
  });
  const set = find(catalog.questionSets, 'QS021');
  assert.deepEqual(set.questionIds, ids);
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
  assert.equal(find(catalog.sources, 'FNT-0029').official, true);
  assert.equal(find(catalog.sources, 'FNT-0029').temporalStatus, 'Vigente');
});
