import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
function findById(collection, id) { return collection.find((item) => item.id === id); }
const questionIds = ['Q000113','Q000114','Q000115','Q000116','Q000117','Q000118','Q000119'];

test('LOT-0018 permanece íntegro no catálogo cumulativo v18', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 18);
  assert.equal(catalog.publication.lotId, 'LOT-0023');
  assert.equal(catalog.units.length, 18);
  assert.equal(catalog.materials.length, 18);
  assert.equal(catalog.questions.length, 119);
  assert.equal(catalog.questionSets.length, 18);
});

test('taxonomia e fonte de Culpabilidade estão presentes e coerentes', () => {
  const topic = findById(catalog.topics, 'ASS-DPEN-003-03');
  const source = findById(catalog.sources, 'FNT-0002');
  assert.ok(topic);
  assert.equal(topic.subjectId, 'MAT-DPEN');
  assert.equal(topic.parentId, 'ASS-DPEN-003');
  assert.ok(source);
  assert.equal(source.official, true);
  assert.equal(source.temporalStatus, 'Vigente');
});

test('U018 referencia fonte, matéria e componentes auditados', () => {
  const unit = findById(catalog.units, 'U018');
  assert.ok(unit);
  assert.equal(unit.subjectId, 'MAT-DPEN');
  assert.deepEqual(unit.topicIds, ['ASS-DPEN-003-03']);
  assert.deepEqual(unit.sourceIds, ['FNT-0002']);
  assert.deepEqual(unit.materialIds, ['M018']);
  assert.deepEqual(unit.questionIds, questionIds);
  assert.deepEqual(unit.questionSetIds, ['QS018']);
});

test('M018 mantém teoria separada das questões', () => {
  const material = findById(catalog.materials, 'M018');
  assert.ok(material);
  assert.equal(material.unitId, 'U018');
  assert.equal(material.required, true);
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  assert.equal('options' in material, false);
});

test('sete questões da U018 mantêm gabaritos e integridade editorial', () => {
  const expected = { Q000113:'A',Q000114:'B',Q000115:'C',Q000116:'D',Q000117:'E',Q000118:'A',Q000119:'B' };
  for (const [id, answer] of Object.entries(expected)) {
    const question = findById(catalog.questions, id);
    assert.ok(question, id);
    assert.equal(question.answer, answer, id);
    assert.equal(question.unitId, 'U018', id);
    assert.equal(question.subjectId, 'MAT-DPEN', id);
    assert.deepEqual(question.topicIds, ['ASS-DPEN-003-03'], id);
    assert.deepEqual(question.sourceIds, ['FNT-0002'], id);
    assert.equal(question.options.length, 5, id);
    assert.ok(question.options.some((option) => option.id === answer), id);
    assert.ok(question.commentary.length > 20, id);
    assert.ok(question.foundation.length > 10, id);
    assert.equal(question.annulled, false, id);
    assert.equal(question.duplicateOf, null, id);
    assert.equal(question.imageRequired, false, id);
    assert.equal(question.valid, true, id);
  }
});

test('QS018 apenas referencia questões do Banco Mestre na ordem auditada', () => {
  const set = findById(catalog.questionSets, 'QS018');
  assert.ok(set);
  assert.equal(set.unitId, 'U018');
  assert.equal(set.correctionMode, 'Por questão');
  assert.deepEqual(set.questionIds, questionIds);
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});
