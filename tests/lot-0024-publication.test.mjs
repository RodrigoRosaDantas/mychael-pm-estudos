import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const find = (collection, id) => collection.find((item) => item.id === id);
const ids = ['Q000155','Q000156','Q000157','Q000158','Q000159','Q000160','Q000161'];
const answers = ['C','A','D','B','E','C','A'];

test('catálogo v20 integra LOT-0024 sem quebrar validação global', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.equal(catalog.contentVersion, 20);
  assert.equal(catalog.publication.lotId, 'LOT-0024');
  assert.equal(catalog.units.length, 20);
  assert.equal(catalog.materials.length, 20);
  assert.equal(catalog.questions.length, 133);
  assert.equal(catalog.questionSets.length, 20);
});

test('U024 preserva teoria separada e sete questões auditadas', () => {
  const unit = find(catalog.units, 'U024');
  assert.ok(unit);
  assert.deepEqual(unit.materialIds, ['M024']);
  assert.deepEqual(unit.questionIds, ids);
  assert.deepEqual(unit.questionSetIds, ['QS024']);
  assert.deepEqual(unit.sourceIds, ['FNT-0028']);
  assert.deepEqual(unit.coverage, ['PMDF','PMGO','PMMG']);

  const material = find(catalog.materials, 'M024');
  assert.ok(material);
  assert.equal(material.unitId, 'U024');
  assert.equal('questionIds' in material, false);
  assert.equal('answer' in material, false);

  ids.forEach((id, index) => {
    const q = find(catalog.questions, id);
    assert.ok(q, id);
    assert.equal(q.unitId, 'U024', id);
    assert.equal(q.subjectId, 'MAT-PORT', id);
    assert.deepEqual(q.topicIds, ['ASS-PORT-005'], id);
    assert.equal(q.answer, answers[index], id);
    assert.equal(q.options.length, 5, id);
    assert.ok(q.commentary.length > 20, id);
    assert.ok(q.foundation.length > 10, id);
    assert.ok(q.difficulty, id);
    assert.equal(q.origin, 'Inédita', id);
    assert.deepEqual(q.sourceIds, ['FNT-0028'], id);
    assert.equal(q.annulled, false, id);
    assert.equal(q.duplicateOf, null, id);
    assert.equal(q.imageRequired, false, id);
    assert.equal(q.valid, true, id);
  });

  const set = find(catalog.questionSets, 'QS024');
  assert.ok(set);
  assert.deepEqual(set.questionIds, ids);
  assert.equal('questions' in set, false);
  assert.equal('answers' in set, false);
});
