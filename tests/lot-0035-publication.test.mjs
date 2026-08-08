import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000232','Q000233','Q000234','Q000235','Q000236','Q000237','Q000238'];
const answers = ['C','A','D','B','E','C','A'];

test('LOT-0035 permanece íntegro no catálogo cumulativo posterior', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(find(catalog.units, 'U035'));
  assert.ok(find(catalog.materials, 'M035'));
  assert.ok(find(catalog.questionSets, 'QS035'));
  ids.forEach((id) => assert.ok(find(catalog.questions, id), id));
});

test('U035 preserva CPPM vigente, teoria separada e sete questões auditadas', () => {
  const subject = find(catalog.subjects, 'MAT-PPM');
  const parent = find(catalog.topics, 'ASS-PPM-001');
  const topic = find(catalog.topics, 'ASS-PPM-001-01');
  const cppm = find(catalog.sources, 'FNT-0005');
  const pmdf = find(catalog.sources, 'FNT-0015');
  const pmgo = find(catalog.sources, 'FNT-0014');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMDF','PMGO']);
  assert.ok(parent); assert.ok(topic); assert.equal(parent.subjectId, 'MAT-PPM'); assert.equal(topic.parentId, 'ASS-PPM-001');
  assert.ok(cppm); assert.equal(cppm.official, true); assert.equal(cppm.temporalStatus, 'Vigente'); assert.equal(cppm.priority, 'Primária');
  assert.ok(pmdf); assert.equal(pmdf.temporalStatus, 'Histórica');
  assert.ok(pmgo); assert.equal(pmgo.temporalStatus, 'Histórica');

  const unit = find(catalog.units, 'U035');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMGO']);
  assert.deepEqual(unit.topicIds, ['ASS-PPM-001','ASS-PPM-001-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0005']);
  assert.deepEqual(unit.materialIds, ['M035']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS035']); assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M035');
  assert.ok(material); assert.equal(material.unitId, 'U035'); assert.deepEqual(material.sourceIds, ['FNT-0005']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['arts. 1º a 6º','Regra geral','Tratados','Interpretação','Caso omisso','Aplicação no espaço','Aplicação no tempo','Justiça Militar Estadual','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U035',id); assert.equal(q.subjectId,'MAT-PPM',id); assert.deepEqual(q.topicIds,['ASS-PPM-001-01'],id); assert.deepEqual(q.sourceIds,['FNT-0005'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS035');
  assert.ok(set); assert.equal(set.unitId,'U035'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
