import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000183','Q000184','Q000185','Q000186','Q000187','Q000188','Q000189'];
const answers = ['A','C','A','B','D','A','C'];

test('catálogo v23 integra LOT-0028 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 23);
  assert.equal(catalog.publication.lotId, 'LOT-0028');
  assert.equal(catalog.units.length, 23);
  assert.equal(catalog.materials.length, 23);
  assert.equal(catalog.questions.length, 154);
  assert.equal(catalog.questionSets.length, 23);
});

test('U028 preserva taxonomia, teoria separada e sete questões auditadas', () => {
  const parent = find(catalog.topics, 'ASS-PORT-006');
  const topic = find(catalog.topics, 'ASS-PORT-006-02');
  assert.ok(parent); assert.ok(topic); assert.equal(topic.parentId, 'ASS-PORT-006'); assert.equal(topic.subjectId, 'MAT-PORT');

  const unit = find(catalog.units, 'U028');
  assert.ok(unit);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-PORT-006','ASS-PORT-006-02']);
  assert.deepEqual(unit.sourceIds, ['FNT-0028']);
  assert.deepEqual(unit.materialIds, ['M028']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS028']);
  assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M028');
  assert.ok(material); assert.equal(material.unitId, 'U028'); assert.deepEqual(material.sourceIds, ['FNT-0028']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Ideia central','teste do masculino','Casos básicos com crase','Casos básicos sem crase','Método de prova','Erros comuns','Resumo da aula','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U028',id); assert.equal(q.subjectId,'MAT-PORT',id); assert.deepEqual(q.topicIds,['ASS-PORT-006-02'],id); assert.deepEqual(q.sourceIds,['FNT-0028'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS028');
  assert.ok(set); assert.equal(set.unitId,'U028'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Por questão'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
