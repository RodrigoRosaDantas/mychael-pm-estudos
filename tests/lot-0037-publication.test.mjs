import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000246','Q000247','Q000248','Q000249','Q000250','Q000251','Q000252'];
const answers = ['B','D','A','C','E','B','A'];

test('catálogo v34 integra LOT-0037 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 34);
  assert.equal(catalog.publication.lotId, 'LOT-0037');
  assert.equal(catalog.units.length, 34);
  assert.equal(catalog.materials.length, 34);
  assert.equal(catalog.questions.length, 231);
  assert.equal(catalog.questionSets.length, 34);
});

test('U037 preserva RIDE vigente, especificidade PMDF e rotação ainda desativada', () => {
  const subject = find(catalog.subjects, 'MAT-RIDE');
  const parent = find(catalog.topics, 'ASS-RIDE-001');
  const topic = find(catalog.topics, 'ASS-RIDE-001-01');
  const lc = find(catalog.sources, 'FNT-0032');
  const decree = find(catalog.sources, 'FNT-0033');
  const historical = find(catalog.sources, 'FNT-0015');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMDF']);
  assert.ok(parent); assert.ok(topic); assert.equal(parent.subjectId, 'MAT-RIDE'); assert.equal(topic.parentId, 'ASS-RIDE-001');
  assert.equal(parent.historicalIncidence, 'Baixa'); assert.equal(topic.historicalIncidence, 'Baixa');
  assert.ok(lc); assert.equal(lc.official, true); assert.equal(lc.temporalStatus, 'Vigente'); assert.equal(lc.lastVerifiedAt, '2026-08-08');
  assert.ok(decree); assert.equal(decree.official, true); assert.equal(decree.temporalStatus, 'Vigente'); assert.equal(decree.lastVerifiedAt, '2026-08-08');
  assert.ok(historical); assert.equal(historical.temporalStatus, 'Histórica');

  const unit = find(catalog.units, 'U037');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF']); assert.equal(unit.firstTrail, false);
  assert.deepEqual(unit.topicIds, ['ASS-RIDE-001','ASS-RIDE-001-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0032','FNT-0033']);
  assert.deepEqual(unit.materialIds, ['M037']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS037']); assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M037');
  assert.ok(material); assert.equal(material.unitId, 'U037'); assert.deepEqual(material.sourceIds, ['FNT-0032','FNT-0033']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Comece por uma ideia simples','Finalidade da RIDE','Quem integra','COARIDE','Serviços públicos','Quadro comparativo','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U037',id); assert.equal(q.subjectId,'MAT-RIDE',id); assert.deepEqual(q.topicIds,['ASS-RIDE-001-01'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.sourceIds.every((sourceId)=>['FNT-0032','FNT-0033'].includes(sourceId)),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS037');
  assert.ok(set); assert.equal(set.unitId,'U037'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);

  const rule=applicability.unitApplicability.find((item)=>item.unitId==='U037');
  assert.ok(rule); assert.equal(rule.classification,'specific-rotation'); assert.deepEqual(rule.competitions,['PMDF']); assert.equal(rule.status,'verified'); assert.deepEqual(rule.evidenceIds,['FNT-0015']);
  assert.equal(applicability.specificRotation.enabled,false);
});
