import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000211','Q000212','Q000213','Q000214','Q000215','Q000216','Q000217'];
const answers = ['B','D','A','C','E','B','D'];

test('catálogo v28 integra LOT-0032 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 28);
  assert.equal(catalog.publication.lotId, 'LOT-0032');
  assert.equal(catalog.units.length, 28);
  assert.equal(catalog.materials.length, 28);
  assert.equal(catalog.questions.length, 189);
  assert.equal(catalog.questionSets.length, 28);
});

test('U032 preserva rastreabilidade histórica, teoria separada e sete questões auditadas', () => {
  const subject = find(catalog.subjects, 'MAT-RLM');
  const parent = find(catalog.topics, 'ASS-RLM-001');
  const topic = find(catalog.topics, 'ASS-RLM-001-01');
  const pmdf = find(catalog.sources, 'FNT-0015');
  const pmmg = find(catalog.sources, 'FNT-0025');
  const corroborator = find(catalog.sources, 'FNT-0026');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMDF','PMMG']);
  assert.ok(parent); assert.ok(topic); assert.equal(parent.subjectId, 'MAT-RLM'); assert.equal(topic.parentId, 'ASS-RLM-001');
  assert.ok(pmdf); assert.equal(pmdf.official, true); assert.equal(pmdf.temporalStatus, 'Histórica');
  assert.ok(pmmg); assert.equal(pmmg.official, false); assert.equal(pmmg.priority, 'Secundária');
  assert.ok(corroborator); assert.equal(corroborator.official, true);

  const unit = find(catalog.units, 'U032');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-RLM-001','ASS-RLM-001-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0015','FNT-0025','FNT-0026']);
  assert.deepEqual(unit.materialIds, ['M032']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS032']); assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M032');
  assert.ok(material); assert.equal(material.unitId, 'U032'); assert.deepEqual(material.sourceIds, ['FNT-0015','FNT-0025','FNT-0026']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Antes da palavra difícil','não entra como proposição','Proposição simples','Proposição composta','Cuidado com a aparência','Verdadeiro e falso','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U032',id); assert.equal(q.subjectId,'MAT-RLM',id); assert.deepEqual(q.topicIds,['ASS-RLM-001-01'],id); assert.deepEqual(q.sourceIds,['FNT-0015','FNT-0025','FNT-0026'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS032');
  assert.ok(set); assert.equal(set.unitId,'U032'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
