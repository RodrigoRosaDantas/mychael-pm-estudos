import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000204','Q000205','Q000206','Q000207','Q000208','Q000209','Q000210'];
const answers = ['C','A','D','B','E','C','A'];

test('LOT-0031 permanece íntegro no catálogo cumulativo posterior', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(find(catalog.units, 'U031'));
  assert.ok(find(catalog.materials, 'M031'));
  assert.ok(find(catalog.questionSets, 'QS031'));
  for (const id of ids) assert.ok(find(catalog.questions, id), id);
});

test('U031 preserva fonte oficial, teoria separada e sete questões auditadas', () => {
  const parent = find(catalog.topics, 'ASS-DH-007');
  const topic = find(catalog.topics, 'ASS-DH-007-01');
  const source = find(catalog.sources, 'FNT-0031');
  assert.ok(parent); assert.ok(topic);
  assert.equal(parent.subjectId, 'MAT-DH');
  assert.equal(topic.parentId, 'ASS-DH-007');
  assert.equal(topic.subjectId, 'MAT-DH');
  assert.ok(source); assert.equal(source.official, true); assert.equal(source.priority, 'Primária');

  const unit = find(catalog.units, 'U031');
  assert.ok(unit);
  assert.deepEqual(unit.coverage, ['PMDF','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-DH-007','ASS-DH-007-01']);
  assert.deepEqual(unit.sourceIds, ['FNT-0031']);
  assert.deepEqual(unit.materialIds, ['M031']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS031']);
  assert.equal(unit.reviewPlanned, true);

  const material = find(catalog.materials, 'M031');
  assert.ok(material); assert.equal(material.unitId, 'U031'); assert.deepEqual(material.sourceIds, ['FNT-0031']);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  for (const term of ['Comece pelo nome','artigos 1 e 2','Personalidade jurídica e vida','Integridade pessoal','Liberdade pessoal','Garantias judiciais','Proteção judicial','Erros comuns','Resumo','Orientação de revisão']) assert.ok(headings.some((heading) => heading.toLowerCase().includes(term.toLowerCase())), term);

  ids.forEach((id,index)=>{
    const q=find(catalog.questions,id);
    assert.ok(q,id); assert.equal(q.unitId,'U031',id); assert.equal(q.subjectId,'MAT-DH',id); assert.deepEqual(q.topicIds,['ASS-DH-007-01'],id); assert.deepEqual(q.sourceIds,['FNT-0031'],id); assert.equal(q.answer,answers[index],id); assert.equal(q.options.length,5,id); assert.ok(q.options.some((o)=>o.id===answers[index]),id); assert.ok(q.commentary.length>20,id); assert.ok(q.foundation.length>20,id); assert.equal(q.annulled,false,id); assert.equal(q.duplicateOf,null,id); assert.equal(q.imageRequired,false,id); assert.equal(q.valid,true,id);
  });

  const set=find(catalog.questionSets,'QS031');
  assert.ok(set); assert.equal(set.unitId,'U031'); assert.deepEqual(set.questionIds,ids); assert.equal(set.correctionMode,'Ao finalizar'); assert.equal('questions' in set,false); assert.equal('answers' in set,false);
});
