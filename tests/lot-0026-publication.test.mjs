import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000169','Q000170','Q000171','Q000172','Q000173','Q000174','Q000175'];
const answers = ['C','A','D','B','E','C','A'];

test('LOT-0026 permanece íntegro no catálogo cumulativo posterior', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(catalog.contentVersion >= 21);
  assert.ok(find(catalog.units,'U026'));
  assert.ok(find(catalog.materials,'M026'));
  assert.ok(find(catalog.questionSets,'QS026'));
});

test('U026 preserva teoria separada e sete questões auditadas', () => {
  const unit = find(catalog.units, 'U026');
  assert.ok(unit);
  assert.deepEqual(unit.materialIds, ['M026']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS026']);
  assert.deepEqual(unit.sourceIds, ['FNT-0030','FNT-0028']);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO','PMMG']);
  assert.deepEqual(unit.topicIds, ['ASS-PORT-004-02']);

  const topic = find(catalog.topics, 'ASS-PORT-004-02');
  assert.ok(topic);
  assert.equal(topic.subjectId, 'MAT-PORT');
  assert.equal(topic.parentId, 'ASS-PORT-004');

  const material = find(catalog.materials, 'M026');
  assert.ok(material);
  assert.equal(material.unitId, 'U026');
  assert.deepEqual(material.sourceIds, ['FNT-0030','FNT-0028']);
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);
  assert.equal('options' in material, false);

  ids.forEach((id, index) => {
    const q = find(catalog.questions, id);
    assert.ok(q, id);
    assert.equal(q.unitId, 'U026', id);
    assert.equal(q.subjectId, 'MAT-PORT', id);
    assert.deepEqual(q.topicIds, ['ASS-PORT-004-02'], id);
    assert.deepEqual(q.sourceIds, ['FNT-0030','FNT-0028'], id);
    assert.equal(q.answer, answers[index], id);
    assert.equal(q.options.length, 5, id);
    assert.ok(q.options.some((option) => option.id === answers[index]), id);
    assert.ok(q.commentary.length > 20, id);
    assert.ok(q.foundation.length > 10, id);
    assert.equal(q.origin, 'Inédita', id);
    assert.equal(q.annulled, false, id);
    assert.equal(q.duplicateOf, null, id);
    assert.equal(q.imageRequired, false, id);
    assert.equal(q.valid, true, id);
  });

  const set = find(catalog.questionSets, 'QS026');
  assert.ok(set);
  assert.deepEqual(set.questionIds, ids);
  assert.equal(set.correctionMode, 'Por questão');
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});
