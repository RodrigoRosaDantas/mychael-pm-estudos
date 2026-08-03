import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCatalog,
  buildManifest,
  evaluateLot,
  sha256,
  sourceFingerprint,
  stableStringify
} from '../scripts/lot-exporter.mjs';

function catalog() {
  return {
    schemaVersion: 1,
    contentVersion: 1,
    studentProfileId: 'STU-MYCHAEL',
    features: { essay: false, taf: true, previousExams: true },
    subjects: [{ id: 'MAT-1' }],
    topics: [{ id: 'TOP-1' }],
    sources: [{ id: 'FNT-1' }],
    units: [{ id: 'U1' }],
    materials: [{ id: 'M1' }],
    questions: [{ id: 'Q1' }],
    questionSets: [{ id: 'QS1' }],
    tafRecords: [],
    previousExams: []
  };
}

function record(id, type) {
  return {
    id,
    type,
    notionPageId: `page-${id}`,
    version: 1,
    lastEditedAt: '2026-08-03T00:00:00Z',
    editorialStatus: 'Aprovado',
    publicationStatus: ['unit', 'material', 'question', 'questionSet'].includes(type)
      ? 'Fila de exportação'
      : 'Não programado'
  };
}

function readySnapshot() {
  return {
    lot: { id: 'LOT-1', version: 1, authorized: true, publicationStatus: 'Fila de exportação' },
    subjects: [record('MAT-1', 'subject')],
    topics: [{ ...record('TOP-1', 'topic'), subjectId: 'MAT-1' }],
    sources: [record('FNT-1', 'source')],
    units: [{
      ...record('U1', 'unit'),
      subjectId: 'MAT-1',
      topicIds: ['TOP-1'],
      sourceIds: ['FNT-1'],
      materialIds: ['M1'],
      questionIds: ['Q1'],
      questionSetIds: ['QS1']
    }],
    materials: [{
      ...record('M1', 'material'),
      unitId: 'U1',
      subjectId: 'MAT-1',
      topicIds: ['TOP-1'],
      sourceIds: ['FNT-1']
    }],
    questions: [{
      ...record('Q1', 'question'),
      unitId: 'U1',
      subjectId: 'MAT-1',
      topicIds: ['TOP-1'],
      sourceIds: ['FNT-1'],
      statement: 'Texto',
      options: ['A', 'B'],
      answer: 'A',
      commentary: 'Comentário',
      foundation: 'Fundamento',
      answerVerified: true,
      sourceVerified: true,
      complete: true,
      annulled: false,
      duplicate: false,
      imageRequired: false,
      imageValidated: true
    }],
    questionSets: [{ ...record('QS1', 'questionSet'), unitId: 'U1', questionIds: ['Q1'] }],
    catalog: catalog()
  };
}

test('serialização e hash são determinísticos', () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(sha256({ b: 2, a: 1 }), sha256({ a: 1, b: 2 }));
  assert.equal(sourceFingerprint(record('U1', 'unit')), sourceFingerprint({ ...record('U1', 'unit') }));
});

test('bloqueia lote sem autorização e taxonomia em rascunho', () => {
  const snapshot = readySnapshot();
  snapshot.lot.authorized = false;
  snapshot.subjects[0].editorialStatus = 'Rascunho';
  const errors = evaluateLot(snapshot);
  assert.ok(errors.some((error) => error.includes('não autorizada')));
  assert.ok(errors.some((error) => error.includes('MAT-1: estado editorial Rascunho')));
});

test('bloqueia relação quebrada e questão incompleta', () => {
  const snapshot = readySnapshot();
  snapshot.units[0].sourceIds = ['FNT-INEXISTENTE'];
  snapshot.questions[0].answerVerified = false;
  const errors = evaluateLot(snapshot);
  assert.ok(errors.some((error) => error.includes('relação quebrada')));
  assert.ok(errors.some((error) => error.includes('gabarito não verificado')));
});

test('manifesto bloqueado é gerado sem dados pessoais', () => {
  const snapshot = readySnapshot();
  snapshot.lot.authorized = false;
  const manifest = buildManifest(snapshot, '2026-08-03T00:00:00Z');
  assert.equal(manifest.status, 'blocked');
  assert.equal(manifest.recordCount, 7);
  assert.match(manifest.lotSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(manifest).includes('@'), false);
});

test('lote apto produz catálogo público normalizado', () => {
  const snapshot = readySnapshot();
  assert.deepEqual(evaluateLot(snapshot), []);
  const output = buildCatalog(snapshot);
  assert.equal(output.contentVersion, 1);
  assert.equal(output.features.essay, false);
});
