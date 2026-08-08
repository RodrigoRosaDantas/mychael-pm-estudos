import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000253','Q000254','Q000255','Q000256','Q000257','Q000258','Q000259'];
const answers = ['B','D','A','C','E','B','D'];

test('catálogo v35 integra LOT-0038 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 35);
  assert.equal(catalog.publication.lotId, 'LOT-0038');
  assert.equal(catalog.units.length, 35);
  assert.equal(catalog.materials.length, 35);
  assert.equal(catalog.questions.length, 238);
  assert.equal(catalog.questionSets.length, 35);
});

test('U038 preserva geografia física atual, especificidade PMGO e rotação ainda desativada', () => {
  const subject = find(catalog.subjects, 'MAT-GGO');
  const parent = find(catalog.topics, 'ASS-GGO-001');
  const vegetation = find(catalog.topics, 'ASS-GGO-001-01');
  const hydro = find(catalog.topics, 'ASS-GGO-001-02');
  const climate = find(catalog.topics, 'ASS-GGO-001-03');
  const goias = find(catalog.sources, 'FNT-0034');
  const ibge = find(catalog.sources, 'FNT-0035');
  const historical = find(catalog.sources, 'FNT-0014');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMGO']);
  for (const topic of [parent,vegetation,hydro,climate]) { assert.ok(topic); assert.equal(topic.subjectId,'MAT-GGO'); assert.equal(topic.historicalIncidence,'Baixa'); }
  assert.equal(vegetation.parentId,'ASS-GGO-001'); assert.equal(hydro.parentId,'ASS-GGO-001'); assert.equal(climate.parentId,'ASS-GGO-001');
  assert.ok(goias); assert.equal(goias.official,true); assert.equal(goias.temporalStatus,'Vigente'); assert.equal(goias.lastVerifiedAt,'2026-08-08');
  assert.ok(ibge); assert.equal(ibge.official,true); assert.equal(ibge.temporalStatus,'Vigente'); assert.equal(ibge.lastVerifiedAt,'2026-08-08');
  assert.ok(historical); assert.equal(historical.temporalStatus,'Histórica');

  const unit=find(catalog.units,'U038');
  assert.ok(unit); assert.deepEqual(unit.coverage,['PMGO']); assert.equal(unit.firstTrail,false);
  assert.deepEqual(unit.topicIds,['ASS-GGO-001','ASS-GGO-001-01','ASS-GGO-001-02','ASS-GGO-001-03']);
  assert.deepEqual(unit.sourceIds,['FNT-0034','FNT-0035']); assert.deepEqual(unit.materialIds,['M038']); assert.deepEqual(unit.questionIds,ids); assert.deepEqual(unit.questionSetIds,['QS038']); assert.equal(unit.reviewPlanned,true);

  const material=find(catalog.materials,'M038');
  assert.ok(material); assert.equal(material.unitId,'U038'); assert.deepEqual(material.sourceIds,['FNT-0034','FNT-0035']);
  assert.equal('questionIds' in material,false); assert.equal('answer' in material,false); assert.equal('options' in material,false);
  const headings=material.blocks.filter(({type})=>type==='heading').map(({text})=>text);
  for (const term of ['Comece por uma ideia simples','Vegetação','Clima','Hidrografia','Como juntar','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((h)=>h.toLowerCase().includes(term.toLowerCase())),term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U038',id); assert.equal(q.subjectId,'MAT-GGO',id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.sourceIds.every((sourceId)=>['FNT-0034','FNT-0035'].includes(sourceId)),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS038');
  assert.ok(set); assert.equal(set.unitId,'U038'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);

  const rule=applicability.unitApplicability.find((item)=>item.unitId==='U038');
  assert.ok(rule); assert.equal(rule.classification,'specific-rotation'); assert.deepEqual(rule.competitions,['PMGO']); assert.equal(rule.status,'verified'); assert.deepEqual(rule.evidenceIds,['FNT-0014']);
  assert.equal(applicability.specificRotation.enabled,false);
});
