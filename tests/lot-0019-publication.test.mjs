import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000120','Q000121','Q000122','Q000123','Q000124','Q000125','Q000126'];
const answers = ['B','D','A','C','E','B','D'];

test('catálogo v21 preserva LOT-0019 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 21);
  assert.equal(catalog.publication.lotId, 'LOT-0026');
  assert.equal(catalog.units.length, 21);
  assert.equal(catalog.materials.length, 21);
  assert.equal(catalog.questions.length, 140);
  assert.equal(catalog.questionSets.length, 21);
});

test('U019 preserva teoria separada e sete questões auditadas', () => {
  const unit = find(catalog.units, 'U019');
  assert.ok(unit);
  assert.deepEqual(unit.materialIds, ['M019']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS019']);
  assert.deepEqual(unit.sourceIds, ['FNT-0002']);
  assert.deepEqual(unit.coverage, ['PMGO','PMDF']);

  const material = find(catalog.materials, 'M019');
  assert.ok(material);
  assert.equal(material.unitId, 'U019');
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);

  ids.forEach((id, index) => {
    const q = find(catalog.questions, id);
    assert.ok(q, id);
    assert.equal(q.unitId, 'U019', id);
    assert.equal(q.subjectId, 'MAT-DPEN', id);
    assert.deepEqual(q.topicIds, ['ASS-DPEN-004'], id);
    assert.equal(q.answer, answers[index], id);
    assert.equal(q.options.length, 5, id);
    assert.ok(q.commentary.length > 20, id);
    assert.ok(q.foundation.length > 10, id);
    assert.ok(q.difficulty, id);
    assert.equal(q.origin, 'Inédita', id);
    assert.deepEqual(q.sourceIds, ['FNT-0002'], id);
    assert.equal(q.annulled, false, id);
    assert.equal(q.duplicateOf, null, id);
    assert.equal(q.imageRequired, false, id);
    assert.equal(q.valid, true, id);
  });

  const set = find(catalog.questionSets, 'QS019');
  assert.ok(set);
  assert.deepEqual(set.questionIds, ids);
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});
