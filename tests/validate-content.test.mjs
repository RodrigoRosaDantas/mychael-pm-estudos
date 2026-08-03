import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from '../scripts/content-rules.mjs';

function baseCatalog() {
  return {
    schemaVersion: 1,
    contentVersion: 0,
    studentProfileId: 'STU-MYCHAEL',
    features: { essay: false, taf: true, previousExams: true },
    subjects: [], topics: [], sources: [], units: [], materials: [], questions: [], questionSets: [], tafRecords: [], previousExams: []
  };
}

test('catálogo vazio inicial é válido', () => {
  assert.deepEqual(validateCatalog(baseCatalog()), []);
});

test('bloqueia dados pessoais', () => {
  const catalog = baseCatalog();
  catalog.studentAnswers = ['A'];
  assert.ok(validateCatalog(catalog).some((error) => error.includes('proibido')));
});

test('bloqueia questão sem gabarito e fundamento', () => {
  const catalog = baseCatalog();
  catalog.questions.push({ id: 'Q1', statement: 'Texto', sourceIds: ['F1'], subjectId: 'S1', topicIds: ['T1'] });
  const errors = validateCatalog(catalog);
  assert.ok(errors.some((error) => error.includes('answer')));
  assert.ok(errors.some((error) => error.includes('foundation')));
});

test('bloqueia índice histórico marcado como vigente', () => {
  const catalog = baseCatalog();
  catalog.tafRecords.push({ id: 'TAF1', temporalStatus: 'historical', current: true, sourceIds: ['F1'] });
  assert.ok(validateCatalog(catalog).some((error) => error.includes('histórico')));
});

test('bloqueia IDs duplicados entre coleções', () => {
  const catalog = baseCatalog();
  catalog.subjects.push({ id: 'X1', name: 'Português' });
  catalog.units.push({ id: 'X1', title: 'Unidade' });
  assert.ok(validateCatalog(catalog).some((error) => error.includes('ID duplicado')));
});
