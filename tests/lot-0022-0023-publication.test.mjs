import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);

function assertQuestion(id, unitId, answer) {
  const q = find(catalog.questions, id);
  assert.ok(q, id);
  assert.equal(q.unitId, unitId, id);
  assert.equal(q.subjectId, 'MAT-PORT', id);
  assert.equal(q.answer, answer, id);
  assert.equal(q.options.length, 5, id);
  assert.ok(q.options.some((option) => option.id === answer), id);
  assert.ok(q.commentary.length > 20, id);
  assert.ok(q.foundation.length > 10, id);
  assert.ok(q.difficulty, id);
  assert.equal(q.origin, 'Inédita', id);
  assert.ok(q.sourceIds.length >= 1, id);
  assert.ok(q.topicIds.length >= 1, id);
  assert.equal(q.annulled, false, id);
  assert.equal(q.duplicateOf, null, id);
  assert.equal(q.imageRequired, false, id);
  assert.equal(q.valid, true, id);
}

test('catálogo v18 integra LOT-0022 e LOT-0023 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 18);
  assert.equal(catalog.publication.lotId, 'LOT-0023');
  assert.equal(catalog.units.length, 18);
  assert.equal(catalog.materials.length, 18);
  assert.equal(catalog.questions.length, 119);
  assert.equal(catalog.questionSets.length, 18);
});

test('U022 preserva teoria separada e sete questões auditadas', () => {
  const ids = ['Q000141','Q000142','Q000143','Q000144','Q000145','Q000146','Q000147'];
  const answers = ['A','D','C','B','E','A','E'];
  const unit = find(catalog.units, 'U022');
  assert.deepEqual(unit.materialIds, ['M022']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS022']);
  assert.deepEqual(unit.sourceIds, ['FNT-0030','FNT-0028']);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO','PMMG']);
  const material = find(catalog.materials, 'M022');
  assert.equal(material.unitId, 'U022');
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  ids.forEach((id, index) => assertQuestion(id, 'U022', answers[index]));
  const set = find(catalog.questionSets, 'QS022');
  assert.deepEqual(set.questionIds, ids);
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
  const source = find(catalog.sources, 'FNT-0030');
  assert.equal(source.official, true);
  assert.equal(source.temporalStatus, 'Em acompanhamento');
});

test('U023 preserva teoria separada e sete questões auditadas', () => {
  const ids = ['Q000148','Q000149','Q000150','Q000151','Q000152','Q000153','Q000154'];
  const answers = ['B','D','C','A','E','B','D'];
  const unit = find(catalog.units, 'U023');
  assert.deepEqual(unit.materialIds, ['M023']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS023']);
  assert.deepEqual(unit.sourceIds, ['FNT-0028']);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO','PMMG']);
  const material = find(catalog.materials, 'M023');
  assert.equal(material.unitId, 'U023');
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  ids.forEach((id, index) => assertQuestion(id, 'U023', answers[index]));
  const set = find(catalog.questionSets, 'QS023');
  assert.deepEqual(set.questionIds, ids);
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});
