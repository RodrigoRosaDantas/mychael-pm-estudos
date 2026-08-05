import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));

function findById(collection, id) {
  return collection.find((item) => item.id === id);
}

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) value.forEach((item) => collectKeys(item, keys));
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

test('catálogo cumulativo autorizado permanece válido até o LOT-0007', () => {
  assert.equal(catalog.contentVersion, 7);
  assert.equal(catalog.publicationStatus, 'published');
  assert.equal(catalog.publication.lotId, 'LOT-0007');
  assert.equal(catalog.publication.authorized, true);
  assert.deepEqual(validateCatalog(catalog), []);
});

test('LOT-0001 permanece íntegro após a inclusão das U002 a U007', () => {
  assert.ok(findById(catalog.subjects, 'MAT-PORT'));
  assert.ok(findById(catalog.topics, 'ASS-PORT-001'));
  assert.ok(findById(catalog.topics, 'ASS-PORT-001-01'));
  assert.ok(findById(catalog.sources, 'FNT-0009'));
  assert.ok(findById(catalog.sources, 'FNT-0010'));

  const unit = findById(catalog.units, 'U001');
  assert.deepEqual(unit.materialIds, ['M001']);
  assert.deepEqual(unit.questionIds, ['Q000001', 'Q000002', 'Q000003', 'Q000004', 'Q000005']);
  assert.deepEqual(unit.questionSetIds, ['QS001']);

  const answers = Object.fromEntries(
    catalog.questions
      .filter(({ id }) => /^Q00000[1-5]$/.test(id))
      .map(({ id, answer }) => [id, answer])
  );
  assert.deepEqual(answers, {
    Q000001: 'C',
    Q000002: 'A',
    Q000003: 'D',
    Q000004: 'B',
    Q000005: 'E'
  });
});

test('material M001 preserva a sequência pedagógica completa', () => {
  const material = findById(catalog.materials, 'M001');
  const headings = material.blocks
    .filter(({ type }) => type === 'heading')
    .map(({ text }) => text);
  assert.deepEqual(headings, [
    '1. Comece por uma ideia simples',
    '2. Informação explícita',
    '3. Informação implícita',
    '4. Diferença prática',
    '5. Método em quatro passos',
    '6. Exemplos comentados',
    '7. Explicação técnica',
    '8. Erros comuns',
    '9. Resumo da aula',
    '10. Orientação de revisão',
    '11. Fontes editoriais'
  ]);
});

test('todas as questões têm cinco alternativas e gabarito compatível', () => {
  for (const question of catalog.questions) {
    assert.equal(question.options.length, 5, question.id);
    assert.ok(question.options.some(({ id }) => id === question.answer), question.id);
    assert.equal(question.annulled, false, question.id);
    assert.equal(question.valid, true, question.id);
    assert.equal(question.duplicateOf, null, question.id);
    assert.equal(question.imageRequired, false, question.id);
  }
});

test('catálogo não contém dados pessoais nem segredos', () => {
  const forbidden = new Set([
    'email', 'password', 'userId', 'uuid', 'studentAnswers', 'personalAnswers',
    'grades', 'scores', 'studyHistory', 'tafResults', 'deviceData', 'recoveryCodes',
    'serviceRoleKey', 'notionToken', 'privateKey', 'secret', 'accessToken', 'refreshToken'
  ]);
  const found = collectKeys(catalog).filter((key) => forbidden.has(key));
  assert.deepEqual(found, []);
  assert.equal(catalog.features.essay, false);
  assert.equal(catalog.features.taf, true);
});
