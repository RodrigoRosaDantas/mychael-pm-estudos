import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateCatalog } from '../scripts/content-rules.mjs';

const catalogBytes = await readFile(new URL('../content/catalog.json', import.meta.url));
const catalog = JSON.parse(catalogBytes.toString('utf8'));
const manifest = JSON.parse(await readFile(new URL('../content/manifest.json', import.meta.url), 'utf8'));
function findById(collection, id) { return collection.find((item) => item.id === id); }

test('LOT-0002 permanece íntegro no catálogo cumulativo posterior', () => {
  assert.deepEqual(validateCatalog(catalog), []);
  assert.ok(catalog.contentVersion >= 2);
  assert.ok(catalog.units.length >= 2);
  assert.ok(catalog.materials.length >= 2);
  assert.ok(catalog.questions.length >= 11);
  assert.ok(catalog.questionSets.length >= 2);
  assert.ok(catalog.units.some(({ id }) => id === 'U002'));
});

test('U002 permanece referenciando exatamente M002, Q000006 a Q000011 e QS002', () => {
  const unit = findById(catalog.units, 'U002');
  assert.ok(unit); assert.equal(unit.subjectId, 'MAT-PORT');
  assert.deepEqual(unit.topicIds, ['ASS-PORT-001', 'ASS-PORT-001-02']);
  assert.deepEqual(unit.sourceIds, ['FNT-0009', 'FNT-0010', 'FNT-0013']);
  assert.deepEqual(unit.materialIds, ['M002']);
  assert.deepEqual(unit.questionIds, ['Q000006','Q000007','Q000008','Q000009','Q000010','Q000011']);
  assert.deepEqual(unit.questionSetIds, ['QS002']);
});

test('M002 mantém teoria separada das questões e sequência pedagógica completa', () => {
  const material = findById(catalog.materials, 'M002');
  assert.ok(material); assert.equal(material.unitId, 'U002'); assert.equal(material.required, true);
  assert.equal('questionIds' in material, false); assert.equal('answer' in material, false); assert.equal('options' in material, false);
  const headings = material.blocks.filter(({ type }) => type === 'heading').map(({ text }) => text);
  assert.deepEqual(headings, ['1. Comece por uma ideia simples','2. O que é inferência','3. O que é pressuposto','4. O que é subentendido','5. Diferença prática','6. Método em três passos','7. Exemplos comentados','8. Explicação técnica','9. Erros comuns','10. Resumo da aula','11. Orientação de revisão','12. Fontes editoriais']);
});

test('seis questões da U002 mantêm gabaritos auditados e integridade editorial', () => {
  const expected = { Q000006:'B', Q000007:'B', Q000008:'C', Q000009:'D', Q000010:'A', Q000011:'E' };
  for (const [id, answer] of Object.entries(expected)) {
    const question = findById(catalog.questions, id);
    assert.ok(question, id); assert.equal(question.answer, answer, id); assert.equal(question.unitId, 'U002', id);
    assert.equal(question.options.length, 5, id); assert.ok(question.options.some((option) => option.id === answer), id);
    assert.ok(question.commentary.length > 20, id); assert.ok(question.foundation.length > 20, id);
    assert.equal(question.annulled, false, id); assert.equal(question.duplicateOf, null, id);
    assert.equal(question.imageRequired, false, id); assert.equal(question.valid, true, id);
  }
});

test('QS002 apenas referencia questões do Banco Mestre na ordem auditada', () => {
  const set = findById(catalog.questionSets, 'QS002');
  assert.ok(set); assert.equal(set.unitId, 'U002'); assert.equal(set.correctionMode, 'Por questão');
  assert.deepEqual(set.questionIds, ['Q000006','Q000007','Q000008','Q000009','Q000010','Q000011']);
  assert.equal('questions' in set, false); assert.equal('answers' in set, false);
});

test('fonte FNT-0013 e manifesto público correspondem ao catálogo exportado', () => {
  const source = findById(catalog.sources, 'FNT-0013');
  assert.ok(source); assert.equal(source.official, true);
  assert.equal(source.organization, 'Fundação Cecierj / Consórcio Cederj / Diretoria de Extensão');
  assert.equal(source.url, 'https://canal.cecierj.edu.br/recurso/12020');
  const digest = createHash('sha256').update(catalogBytes).digest('hex');
  assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.contentVersion, catalog.contentVersion);
  assert.equal(manifest.files.length, 1); assert.equal(manifest.files[0].path, 'content/catalog.json');
  assert.equal(manifest.files[0].sha256, digest); assert.equal(manifest.files[0].bytes, catalogBytes.length);
});
