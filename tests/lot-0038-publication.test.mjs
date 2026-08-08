import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000253','Q000254','Q000255','Q000256','Q000257','Q000258','Q000259'];
const answers = ['B','D','A','C','E','B','D'];

test('LOT-0038 permanece íntegro no catálogo cumulativo posterior', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(find(catalog.units, 'U038'));
  assert.ok(find(catalog.materials, 'M038'));
  assert.ok(find(catalog.questionSets, 'QS038'));
  ids.forEach((id) => assert.ok(find(catalog.questions, id), id));
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
  ids.forEach((id,index)=>{ const q=find(catalog.questions,id); assert.ok(q,id); assert.equal(q.answer,answers[index],id); assert.equal(q.valid,true,id); });
  const set=find(catalog.questionSets,'QS038'); assert.ok(set); assert.deepEqual(set.questionIds,ids);
  const rule=applicability.unitApplicability.find((item)=>item.unitId==='U038');
  assert.ok(rule); assert.equal(rule.classification,'specific-rotation'); assert.deepEqual(rule.competitions,['PMGO']); assert.deepEqual(rule.evidenceIds,['FNT-0014']);
  assert.equal(applicability.specificRotation.enabled,false);
});
