import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000197','Q000198','Q000199','Q000200','Q000201','Q000202','Q000203'];
const answers = ['C','A','E','B','D','C','A'];

test('catálogo v25 integra LOT-0030 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 25);
  assert.equal(catalog.publication.lotId, 'LOT-0030');
  assert.equal(catalog.units.length, 25);
  assert.equal(catalog.materials.length, 25);
  assert.equal(catalog.questions.length, 168);
  assert.equal(catalog.questionSets.length, 25);
});

test('U030 preserva taxonomia constitucional, teoria separada e sete questões auditadas', () => {
  const parent = find(catalog.topics, 'ASS-DCON-008');
  const topic = find(catalog.topics, 'ASS-DCON-008-01');
  assert.ok(parent); assert.ok(topic);
  assert.equal(parent.subjectId, 'MAT-DCON');
  assert.equal(topic.parentId, 'ASS-DCON-008');
  assert.equal(topic.subjectId, 'MAT-DCON');

  const unit = find(catalog.units, 'U030');
  assert.ok(unit);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-DCON-008','ASS-DCON-008-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0001']);
  assert.deepEqual(unit.materialIds, ['M030']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS030']);
  assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M030');
  assert.ok(material); assert.equal(material.unitId, 'U030'); assert.deepEqual(material.sourceIds, ['FNT-0001']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['frase mais importante','órgãos aparecem','Polícia Federal','Polícia Rodoviária','Polícia Civil x Polícia Militar','Corpos de Bombeiros','Polícias Penais','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U030',id); assert.equal(q.subjectId,'MAT-DCON',id); assert.deepEqual(q.topicIds,['ASS-DCON-008-01'],id); assert.deepEqual(q.sourceIds,['FNT-0001'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS030');
  assert.ok(set); assert.equal(set.unitId,'U030'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Por questão'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
