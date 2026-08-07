import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';
const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
function findById(collection, id) { return collection.find((item) => item.id === id); }
test('LOT-0007 permanece íntegro no catálogo cumulativo v12', () => {
  assert.deepEqual(validateCatalog(catalog), []); assert.equal(catalog.contentVersion, 12); assert.equal(catalog.publication.lotId, 'LOT-0016');
  assert.equal(catalog.units.length, 12); assert.equal(catalog.materials.length, 12); assert.equal(catalog.questions.length, 77); assert.equal(catalog.questionSets.length, 12); assert.ok(findById(catalog.subjects, 'MAT-DCON'));
});
test('U007 referencia taxonomia, fontes e componentes auditados', () => {
  const unit = findById(catalog.units, 'U007'); assert.ok(unit); assert.equal(unit.subjectId, 'MAT-DCON');
  assert.deepEqual(unit.topicIds, ['ASS-DCON-001','ASS-DCON-001-01']); assert.deepEqual(unit.sourceIds, ['FNT-0001','FNT-0023']); assert.deepEqual(unit.materialIds, ['M007']);
  assert.deepEqual(unit.questionIds, ['Q000037','Q000038','Q000039','Q000040','Q000041','Q000042']); assert.deepEqual(unit.questionSetIds, ['QS007']);
});
test('M007 mantém teoria separada das questões e orientação de revisão', () => {
  const material = findById(catalog.materials, 'M007'); assert.ok(material); assert.equal(material.unitId, 'U007'); assert.equal(material.required, true);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Erros comuns','Resumo da aula','Orientação de revisão']) assert.ok(headings.some((heading) => heading.includes(term)));
});
test('seis questões da U007 mantêm gabaritos e integridade editorial', () => {
  const expected = { Q000037:'B',Q000038:'C',Q000039:'B',Q000040:'C',Q000041:'B',Q000042:'D' };
  for (const [id, answer] of Object.entries(expected)) { const question = findById(catalog.questions, id); assert.ok(question,id); assert.equal(question.answer,answer,id); assert.equal(question.unitId,'U007',id); assert.equal(question.subjectId,'MAT-DCON',id); assert.deepEqual(question.sourceIds,['FNT-0001','FNT-0023'],id); assert.equal(question.options.length,5,id); assert.ok(question.options.some((option)=>option.id===answer),id); assert.ok(question.commentary.length>20,id); assert.ok(question.foundation.length>20,id); assert.equal(question.annulled,false,id); assert.equal(question.duplicateOf,null,id); assert.equal(question.imageRequired,false,id); assert.equal(question.valid,true,id); }
});
test('QS007 apenas referencia questões do Banco Mestre na ordem auditada', () => { const set=findById(catalog.questionSets,'QS007'); assert.ok(set); assert.equal(set.unitId,'U007'); assert.equal(set.correctionMode,'Por questão'); assert.deepEqual(set.questionIds,['Q000037','Q000038','Q000039','Q000040','Q000041','Q000042']); assert.equal('questions' in set,false); assert.equal('answers' in set,false); });
test('fontes constitucionais preservam hierarquia e situação temporal', () => { const constitution=findById(catalog.sources,'FNT-0001'); const senate=findById(catalog.sources,'FNT-0023'); assert.equal(constitution.official,true); assert.equal(constitution.priority,'Primária'); assert.equal(constitution.temporalStatus,'Vigente'); assert.equal(senate.official,true); assert.equal(senate.priority,'Secundária'); assert.equal(senate.temporalStatus,'Histórica'); });
