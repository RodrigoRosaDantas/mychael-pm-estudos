import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';
const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
function findById(collection, id) { return collection.find((item) => item.id === id); }
test('LOT-0006 permanece íntegro no catálogo cumulativo v12', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 12);
  assert.equal(catalog.publication.lotId, 'LOT-0016');
  assert.equal(catalog.units.length, 12);
  assert.equal(catalog.materials.length, 12);
  assert.equal(catalog.questions.length, 77);
  assert.equal(catalog.questionSets.length, 12);
});
test('U006 referencia taxonomia, fontes e componentes auditados', () => {
  const unit = findById(catalog.units, 'U006'); assert.ok(unit);
  assert.deepEqual(unit.topicIds, ['ASS-PORT-008','ASS-PORT-008-01']); assert.deepEqual(unit.sourceIds, ['FNT-0018','FNT-0019']);
  assert.deepEqual(unit.materialIds, ['M006']); assert.deepEqual(unit.questionIds, ['Q000031','Q000032','Q000033','Q000034','Q000035','Q000036']); assert.deepEqual(unit.questionSetIds, ['QS006']);
});
test('M006 mantém teoria separada das questões e orientação de revisão', () => {
  const material = findById(catalog.materials, 'M006'); assert.ok(material); assert.equal(material.unitId, 'U006'); assert.equal(material.required, true);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Sinonímia','Antonímia','Polissemia','Ambiguidade','Orientação de revisão']) assert.ok(headings.some((heading) => heading.includes(term)), term);
});
test('seis questões da U006 mantêm gabaritos e integridade editorial', () => {
  const expected = { Q000031:'C',Q000032:'A',Q000033:'E',Q000034:'B',Q000035:'D',Q000036:'C' };
  for (const [id, answer] of Object.entries(expected)) {
    const question = findById(catalog.questions, id); assert.ok(question, id); assert.equal(question.answer, answer, id); assert.equal(question.unitId, 'U006', id);
    assert.deepEqual(question.sourceIds, ['FNT-0018','FNT-0019'], id); assert.equal(question.options.length, 5, id); assert.ok(question.options.some((option) => option.id === answer), id);
    assert.ok(question.commentary.length > 20, id); assert.ok(question.foundation.length > 20, id); assert.equal(question.annulled, false, id); assert.equal(question.duplicateOf, null, id); assert.equal(question.imageRequired, false, id); assert.equal(question.valid, true, id);
  }
});
test('QS006 apenas referencia questões do Banco Mestre na ordem auditada', () => {
  const set = findById(catalog.questionSets, 'QS006'); assert.ok(set); assert.equal(set.unitId, 'U006'); assert.equal(set.correctionMode, 'Por questão');
  assert.deepEqual(set.questionIds, ['Q000031','Q000032','Q000033','Q000034','Q000035','Q000036']); assert.equal('questions' in set, false); assert.equal('answers' in set, false);
});
