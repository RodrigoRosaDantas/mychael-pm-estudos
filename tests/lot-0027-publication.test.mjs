import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000176','Q000177','Q000178','Q000179','Q000180','Q000181','Q000182'];
const answers = ['B','D','A','C','E','B','D'];

test('LOT-0027 permanece íntegro no catálogo cumulativo posterior', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(find(catalog.units, 'U027'));
  assert.ok(find(catalog.materials, 'M027'));
  assert.ok(find(catalog.questionSets, 'QS027'));
  for (const id of ids) assert.ok(find(catalog.questions, id), id);
});

test('U027 preserva taxonomia, teoria separada e sete questões auditadas', () => {
  const parent = find(catalog.topics, 'ASS-PORT-006');
  const topic = find(catalog.topics, 'ASS-PORT-006-01');
  assert.ok(parent); assert.ok(topic); assert.equal(topic.parentId, 'ASS-PORT-006');
  const unit = find(catalog.units, 'U027');
  assert.ok(unit); assert.deepEqual(unit.coverage, ['PMDF','PMGO','PMMG']); assert.deepEqual(unit.topicIds, ['ASS-PORT-006','ASS-PORT-006-01']); assert.deepEqual(unit.sourceIds, ['FNT-0028']); assert.deepEqual(unit.materialIds, ['M027']); assert.deepEqual(unit.questionIds, ids); assert.deepEqual(unit.questionSetIds, ['QS027']);
  const material = find(catalog.materials, 'M027');
  assert.ok(material); assert.equal(material.unitId, 'U027'); assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  ids.forEach((id,index)=>{ const q=find(catalog.questions,id); assert.ok(q,id); assert.equal(q.unitId,'U027',id); assert.equal(q.answer,answers[index],id); assert.deepEqual(q.sourceIds,['FNT-0028'],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id); });
  const set=find(catalog.questionSets,'QS027'); assert.ok(set); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Por questão'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
