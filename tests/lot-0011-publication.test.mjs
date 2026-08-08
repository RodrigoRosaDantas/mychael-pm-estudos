import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000064','Q000065','Q000066','Q000067','Q000068','Q000069','Q000070'];
const answers = ['B','D','A','C','E','B','D'];

test('catálogo v31 integra LOT-0011 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 31);
  assert.equal(catalog.publication.lotId, 'LOT-0011');
  assert.equal(catalog.units.length, 31);
  assert.equal(catalog.materials.length, 31);
  assert.equal(catalog.questions.length, 210);
  assert.equal(catalog.questionSets.length, 31);
});

test('U010 preserva princípios administrativos, teoria separada e sete questões auditadas', () => {
  const subject = find(catalog.subjects, 'MAT-DADM');
  const parent = find(catalog.topics, 'ASS-DADM-001');
  const topic = find(catalog.topics, 'ASS-DADM-001-01');
  const cf = find(catalog.sources, 'FNT-0001');
  const support = find(catalog.sources, 'FNT-0024');
  const pmdf = find(catalog.sources, 'FNT-0015');
  const pmgo = find(catalog.sources, 'FNT-0014');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMDF','PMGO']);
  assert.ok(parent); assert.ok(topic); assert.equal(parent.subjectId, 'MAT-DADM'); assert.equal(topic.parentId, 'ASS-DADM-001');
  assert.ok(cf); assert.equal(cf.official, true); assert.equal(cf.temporalStatus, 'Vigente'); assert.equal(cf.priority, 'Primária');
  assert.ok(support); assert.equal(support.official, true); assert.equal(support.priority, 'Secundária');
  assert.ok(pmdf); assert.equal(pmdf.temporalStatus, 'Histórica');
  assert.ok(pmgo); assert.equal(pmgo.temporalStatus, 'Histórica');

  const unit = find(catalog.units, 'U010');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMGO']);
  assert.deepEqual(unit.topicIds, ['ASS-DADM-001','ASS-DADM-001-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0001','FNT-0024']);
  assert.deepEqual(unit.materialIds, ['M010']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS010']); assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M010');
  assert.ok(material); assert.equal(material.unitId, 'U010'); assert.deepEqual(material.sourceIds, ['FNT-0001','FNT-0024']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Comece por uma ideia simples','Legalidade','Impessoalidade','Moralidade','Publicidade','Eficiência','Quadro comparativo','Como diferenciar','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U010',id); assert.equal(q.subjectId,'MAT-DADM',id); assert.deepEqual(q.topicIds,['ASS-DADM-001-01'],id); assert.deepEqual(q.sourceIds,['FNT-0001','FNT-0024'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS010');
  assert.ok(set); assert.equal(set.unitId,'U010'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Por questão'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
