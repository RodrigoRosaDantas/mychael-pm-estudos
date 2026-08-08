import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000239','Q000240','Q000241','Q000242','Q000243','Q000244','Q000245'];
const answers = ['B','D','A','C','E','B','D'];

test('catálogo v33 integra LOT-0036 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 33);
  assert.equal(catalog.publication.lotId, 'LOT-0036');
  assert.equal(catalog.units.length, 33);
  assert.equal(catalog.materials.length, 33);
  assert.equal(catalog.questions.length, 224);
  assert.equal(catalog.questionSets.length, 33);
});

test('U036 preserva CPP vigente, teoria separada e sete questões auditadas', () => {
  const subject = find(catalog.subjects, 'MAT-PPEN');
  const parent = find(catalog.topics, 'ASS-PPEN-000');
  const topic = find(catalog.topics, 'ASS-PPEN-000-01');
  const cpp = find(catalog.sources, 'FNT-0003');
  const pmdf = find(catalog.sources, 'FNT-0015');
  const pmgo = find(catalog.sources, 'FNT-0014');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMDF','PMGO']);
  assert.ok(parent); assert.ok(topic); assert.equal(parent.subjectId, 'MAT-PPEN'); assert.equal(topic.parentId, 'ASS-PPEN-000');
  assert.ok(cpp); assert.equal(cpp.official, true); assert.equal(cpp.temporalStatus, 'Vigente'); assert.equal(cpp.priority, 'Primária'); assert.equal(cpp.lastVerifiedAt, '2026-08-08');
  assert.ok(pmdf); assert.equal(pmdf.temporalStatus, 'Histórica');
  assert.ok(pmgo); assert.equal(pmgo.temporalStatus, 'Histórica');

  const unit = find(catalog.units, 'U036');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMGO']);
  assert.deepEqual(unit.topicIds, ['ASS-PPEN-000','ASS-PPEN-000-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0003']);
  assert.deepEqual(unit.materialIds, ['M036']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS036']); assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M036');
  assert.ok(material); assert.equal(material.unitId, 'U036'); assert.deepEqual(material.sourceIds, ['FNT-0003']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Comece por uma ideia simples','Aplicação no espaço','Aplicação no tempo','lei penal material','Interpretação e integração','Quadro comparativo','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U036',id); assert.equal(q.subjectId,'MAT-PPEN',id); assert.deepEqual(q.topicIds,['ASS-PPEN-000-01'],id); assert.deepEqual(q.sourceIds,['FNT-0003'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS036');
  assert.ok(set); assert.equal(set.unitId,'U036'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
