import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000162','Q000163','Q000164','Q000165','Q000166','Q000167','Q000168'];
const answers = ['B','C','A','D','C','A','D'];

test('LOT-0025 permanece íntegro no catálogo cumulativo posterior', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(find(catalog.units, 'U025'));
  assert.ok(find(catalog.materials, 'M025'));
  assert.ok(find(catalog.questionSets, 'QS025'));
  for (const id of ids) assert.ok(find(catalog.questions, id), id);
});

test('U025 preserva fonte oficial, teoria separada e sete questões auditadas', () => {
  const subject = find(catalog.subjects, 'MAT-DH');
  const topic = find(catalog.topics, 'ASS-DH-005');
  const source = find(catalog.sources, 'FNT-0029');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMDF','PMMG']);
  assert.ok(topic); assert.equal(topic.subjectId, 'MAT-DH');
  assert.ok(source); assert.equal(source.official, true); assert.equal(source.priority, 'Primária');

  const unit = find(catalog.units, 'U025');
  assert.ok(unit);
  assert.deepEqual(unit.coverage, ['PMDF','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-DH-005']);
  assert.deepEqual(unit.sourceIds, ['FNT-0029']);
  assert.deepEqual(unit.materialIds, ['M025']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS025']);
  assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M025');
  assert.ok(material); assert.equal(material.unitId, 'U025'); assert.deepEqual(material.sourceIds, ['FNT-0029']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['O que é a DUDH','dignidade, liberdade e igualdade','Direitos pessoais básicos','banca costuma confundir','Método de memorização','Revisão relâmpago']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U025',id); assert.equal(q.subjectId,'MAT-DH',id); assert.deepEqual(q.topicIds,['ASS-DH-005'],id); assert.deepEqual(q.sourceIds,['FNT-0029'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS025');
  assert.ok(set); assert.equal(set.unitId,'U025'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
