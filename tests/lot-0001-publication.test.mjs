import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));

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

test('LOT-0001 está autorizado e o catálogo é válido', () => {
  assert.equal(catalog.contentVersion, 1);
  assert.equal(catalog.publicationStatus, 'published');
  assert.equal(catalog.publication.lotId, 'LOT-0001');
  assert.equal(catalog.publication.authorized, true);
  assert.deepEqual(validateCatalog(catalog), []);
});

test('publicação contém exatamente a primeira unidade e seus componentes', () => {
  assert.deepEqual(catalog.subjects.map(({ id }) => id), ['MAT-PORT']);
  assert.deepEqual(catalog.topics.map(({ id }) => id), ['ASS-PORT-001', 'ASS-PORT-001-01']);
  assert.deepEqual(catalog.sources.map(({ id }) => id), ['FNT-0009', 'FNT-0010']);
  assert.deepEqual(catalog.units.map(({ id }) => id), ['U001']);
  assert.deepEqual(catalog.materials.map(({ id }) => id), ['M001']);
  assert.deepEqual(catalog.questions.map(({ id }) => id), ['Q000001', 'Q000002', 'Q000003', 'Q000004', 'Q000005']);
  assert.deepEqual(catalog.questionSets.map(({ id }) => id), ['QS001']);
});

test('material preserva a sequência pedagógica completa', () => {
  const headings = catalog.materials[0].blocks
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

test('questões têm cinco alternativas e gabarito compatível', () => {
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
