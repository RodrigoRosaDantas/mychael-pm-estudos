import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000225','Q000226','Q000227','Q000228','Q000229','Q000230','Q000231'];
const answers = ['B','D','A','C','E','B','D'];

test('catálogo v30 integra LOT-0034 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 30);
  assert.equal(catalog.publication.lotId, 'LOT-0034');
  assert.equal(catalog.units.length, 30);
  assert.equal(catalog.materials.length, 30);
  assert.equal(catalog.questions.length, 203);
  assert.equal(catalog.questionSets.length, 30);
});

test('U034 preserva CPM vigente, teoria separada e sete questões auditadas', () => {
  const subject = find(catalog.subjects, 'MAT-DPM');
  const parent = find(catalog.topics, 'ASS-DPM-001');
  const topic = find(catalog.topics, 'ASS-DPM-001-01');
  const cpm = find(catalog.sources, 'FNT-0004');
  const pmdf = find(catalog.sources, 'FNT-0015');
  const pmgo = find(catalog.sources, 'FNT-0014');
  assert.ok(subject); assert.deepEqual(subject.coverage, ['PMDF','PMGO']);
  assert.ok(parent); assert.ok(topic); assert.equal(parent.subjectId, 'MAT-DPM'); assert.equal(topic.parentId, 'ASS-DPM-001');
  assert.ok(cpm); assert.equal(cpm.official, true); assert.equal(cpm.temporalStatus, 'Vigente'); assert.equal(cpm.priority, 'Primária');
  assert.ok(pmdf); assert.equal(pmdf.official, true); assert.equal(pmdf.temporalStatus, 'Histórica');
  assert.ok(pmgo); assert.equal(pmgo.official, true); assert.equal(pmgo.temporalStatus, 'Histórica');

  const unit = find(catalog.units, 'U034');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMGO']);
  assert.deepEqual(unit.topicIds, ['ASS-DPM-001','ASS-DPM-001-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0004']);
  assert.deepEqual(unit.materialIds, ['M034']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS034']); assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M034');
  assert.ok(material); assert.equal(material.unitId, 'U034'); assert.deepEqual(material.sourceIds, ['FNT-0004']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Para que serve','Legalidade','Lei posterior','Lei excepcional','Tempo do crime','Lugar do crime','Territorialidade','Pena cumprida','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U034',id); assert.equal(q.subjectId,'MAT-DPM',id); assert.deepEqual(q.topicIds,['ASS-DPM-001-01'],id); assert.deepEqual(q.sourceIds,['FNT-0004'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS034');
  assert.ok(set); assert.equal(set.unitId,'U034'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
