import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000190','Q000191','Q000192','Q000193','Q000194','Q000195','Q000196'];
const answers = ['B','D','A','C','E','B','D'];

test('LOT-0029 permanece íntegro no catálogo cumulativo posterior', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(find(catalog.units, 'U029'));
  assert.ok(find(catalog.materials, 'M029'));
  assert.ok(find(catalog.questionSets, 'QS029'));
  for (const id of ids) assert.ok(find(catalog.questions, id), id);
});

test('U029 preserva taxonomia constitucional, teoria separada e sete questões auditadas', () => {
  const state = find(catalog.topics, 'ASS-DCON-005');
  const entities = find(catalog.topics, 'ASS-DCON-005-01');
  const administration = find(catalog.topics, 'ASS-DCON-006');
  assert.ok(state); assert.ok(entities); assert.ok(administration);
  assert.equal(state.subjectId, 'MAT-DCON');
  assert.equal(entities.parentId, 'ASS-DCON-005');
  assert.equal(administration.subjectId, 'MAT-DCON');

  const unit = find(catalog.units, 'U029');
  assert.ok(unit);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-DCON-005','ASS-DCON-005-01','ASS-DCON-006']);
  assert.deepEqual(unit.sourceIds, ['FNT-0001']);
  assert.deepEqual(unit.materialIds, ['M029']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS029']);
  assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M029');
  assert.ok(material); assert.equal(material.unitId, 'U029'); assert.deepEqual(material.sourceIds, ['FNT-0001']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Autonomia não é soberania','Brasília','Territórios','Administração Pública','Legislativo e Judiciário','não repete','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U029',id); assert.equal(q.subjectId,'MAT-DCON',id); assert.deepEqual(q.sourceIds,['FNT-0001'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS029');
  assert.ok(set); assert.equal(set.unitId,'U029'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Por questão'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
