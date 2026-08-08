import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000218','Q000219','Q000220','Q000221','Q000222','Q000223','Q000224'];
const answers = ['C','A','D','B','E','C','A'];

test('catálogo v29 integra LOT-0033 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 29);
  assert.equal(catalog.publication.lotId, 'LOT-0033');
  assert.equal(catalog.units.length, 29);
  assert.equal(catalog.materials.length, 29);
  assert.equal(catalog.questions.length, 196);
  assert.equal(catalog.questionSets.length, 29);
});

test('U033 preserva taxonomia compartilhada, teoria separada e sete microtextos autorais', () => {
  const subject = find(catalog.subjects, 'MAT-ING');
  const parent = find(catalog.topics, 'ASS-ING-001');
  const topic = find(catalog.topics, 'ASS-ING-001-01');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMDF','PMMG']);
  assert.ok(parent); assert.ok(topic); assert.equal(parent.subjectId, 'MAT-ING'); assert.equal(topic.parentId, 'ASS-ING-001');
  for (const id of ['FNT-0015','FNT-0025','FNT-0026']) assert.ok(find(catalog.sources,id), id);

  const unit = find(catalog.units, 'U033');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-ING-001','ASS-ING-001-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0015','FNT-0025','FNT-0026']);
  assert.deepEqual(unit.materialIds, ['M033']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS033']); assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M033');
  assert.ok(material); assert.equal(material.unitId, 'U033'); assert.deepEqual(material.sourceIds, ['FNT-0015','FNT-0025','FNT-0026']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['não traduza tudo','procurando o assunto','Ideia principal','Cognatos','contexto','informação explícita','Palavras de referência','cinco passos','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U033',id); assert.equal(q.subjectId,'MAT-ING',id); assert.deepEqual(q.topicIds,['ASS-ING-001-01'],id); assert.deepEqual(q.sourceIds,['FNT-0015','FNT-0025','FNT-0026'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const q223=find(catalog.questions,'Q000223');
  assert.deepEqual(q223.options.map(({text})=>text), ['emergência.','transporte.','exposição.','permissão.','conversa.']);

  const set=find(catalog.questionSets,'QS033');
  assert.ok(set); assert.equal(set.unitId,'U033'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
