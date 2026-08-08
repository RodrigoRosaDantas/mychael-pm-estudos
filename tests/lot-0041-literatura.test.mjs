import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const lot = JSON.parse(await readFile(new URL('../content/lots/lot-0041.json', import.meta.url), 'utf8'));

test('LOT-0041 preserva Literatura específica PMMG sem ativar inferência para outros concursos', () => {
  assert.equal(lot.lotId, 'LOT-0041');
  assert.equal(lot.contentVersion, 37);
  assert.equal(lot.units.length, 1);
  assert.deepEqual(lot.units[0].coverage, ['PMMG']);
  assert.equal(lot.units[0].id, 'U040');
  assert.equal(lot.units[0].subjectId, 'MAT-LIT');
  assert.deepEqual(lot.units[0].topicIds, ['ASS-LIT-001', 'ASS-LIT-002']);
  assert.ok(lot.units[0].sourceIds.includes('FNT-0025'));
});

test('U040 mantém teoria separada e sete questões autorais completas', () => {
  assert.equal(lot.materials.length, 1);
  assert.equal(lot.materials[0].id, 'M040');
  assert.ok(lot.materials[0].blocks.length > 10);
  assert.equal(lot.questions.length, 7);
  assert.deepEqual(lot.questions.map(({ id }) => id), ['Q000267','Q000268','Q000269','Q000270','Q000271','Q000272','Q000273']);
  for (const question of lot.questions) {
    assert.equal(question.origin, 'Autoral');
    assert.equal(question.valid, true);
    assert.equal(question.annulled, false);
    assert.equal(question.imageRequired, false);
    assert.equal(question.options.length, 5);
    assert.ok(question.options.some(({ id }) => id === question.answer));
    assert.ok(question.sourceIds.length > 0);
  }
});

test('QS040 referencia somente as sete questões do Banco Mestre e mantém correção por questão', () => {
  assert.equal(lot.questionSets.length, 1);
  assert.equal(lot.questionSets[0].id, 'QS040');
  assert.equal(lot.questionSets[0].unitId, 'U040');
  assert.equal(lot.questionSets[0].correctionMode, 'Por questão');
  assert.deepEqual(lot.questionSets[0].questionIds, lot.questions.map(({ id }) => id));
});
