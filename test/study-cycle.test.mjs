import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  deriveStudyCycleProgress,
  flattenStudyCycle,
  isReviewDue,
  isSundayInBrasilia,
  studyCycleUnitIds
} from '../assets/study-cycle.js';

const plan = JSON.parse(await readFile(new URL('../content/study-cycle-v1.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));

test('V1 tem quatro ciclos de seis sessões e uma matéria por sessão', () => {
  assert.equal(plan.cycles.length, 4);
  assert.ok(plan.cycles.every((cycle) => cycle.sessions.length === 6));
  assert.equal(flattenStudyCycle(plan).length, 24);
  assert.equal(plan.subjectsPerSession, 1);
  assert.equal(plan.checkpointAfterSession, 24);
});

test('V1 não inclui conteúdo específico', () => {
  const specific = new Set(['U037', 'U038', 'U039', 'U040', 'U041']);
  assert.ok(studyCycleUnitIds(plan).every((id) => !specific.has(id)));
});

test('pré-requisitos essenciais aparecem antes dos dependentes', () => {
  const ids = studyCycleUnitIds(plan);
  const before = (a, b) => assert.ok(ids.indexOf(a) >= 0 && ids.indexOf(a) < ids.indexOf(b), `${a} deve vir antes de ${b}`);
  before('U007', 'U008');
  before('U008', 'U009');
  before('U009', 'U013');
  before('U009', 'U029');
  before('U029', 'U030');
  before('U008', 'U010');
  before('U010', 'U011');
  before('U008', 'U012');
  before('U012', 'U014');
  before('U014', 'U015');
  before('U015', 'U016');
  before('U016', 'U017');
});

test('circulação não é determinada apenas pelo estoque de Português', () => {
  const unitById = new Map(catalog.units.map((unit) => [unit.id, unit]));
  const counts = new Map();
  for (const unitId of studyCycleUnitIds(plan)) {
    const subjectId = unitById.get(unitId)?.subjectId;
    counts.set(subjectId, (counts.get(subjectId) ?? 0) + 1);
  }
  assert.equal(counts.get('MAT-PORT'), 11);
  assert.equal(counts.get('MAT-CONST'), 6);
  assert.equal(counts.get('MAT-DPEN'), 5);
  assert.equal(counts.get('MAT-DADM'), 2);
  assert.equal(counts.size, 4);
});

test('Ciclo 1 permanece preservado para o aluno já iniciado', () => {
  assert.deepEqual(plan.cycles[0].sessions.map(({ unitId }) => unitId), ['U001', 'U007', 'U002', 'U003', 'U008', 'U004']);
});

test('U001 em andamento mantém ciclo 1 sessão 1', () => {
  const progress = deriveStudyCycleProgress({ plan, catalog, studyUnits: [{ unit_id: 'U001', status: 'in_progress' }] });
  assert.equal(progress.current?.unitId, 'U001');
  assert.equal(progress.current?.cycleNumber, 1);
  assert.equal(progress.current?.positionInCycle, 1);
});

test('U001 concluída avança para U007', () => {
  const progress = deriveStudyCycleProgress({ plan, catalog, studyUnits: [{ unit_id: 'U001', status: 'completed' }] });
  assert.equal(progress.current?.unitId, 'U007');
});

test('erro aberto bloqueia unidade marcada como concluída', () => {
  const firstQuestion = catalog.questions.find((question) => question.unitId === 'U001');
  assert.ok(firstQuestion);
  const progress = deriveStudyCycleProgress({ plan, catalog, studyUnits: [{ unit_id: 'U001', status: 'completed' }], openErrorQuestionIds: [firstQuestion.id] });
  assert.equal(progress.current?.unitId, 'U001');
});

test('domingo em Brasília é reconhecido como folga', () => {
  assert.equal(isSundayInBrasilia(new Date('2026-08-09T15:00:00Z')), true);
  assert.equal(isSundayInBrasilia(new Date('2026-08-10T15:00:00Z')), false);
});

test('revisão scheduled com data passada é devida', () => {
  assert.equal(isReviewDue({ status: 'scheduled', next_review_at: '2026-08-04T19:02:21Z' }, Date.parse('2026-08-09T23:00:00Z')), true);
  assert.equal(isReviewDue({ status: 'scheduled', next_review_at: '2026-08-10T19:02:21Z' }, Date.parse('2026-08-09T23:00:00Z')), false);
});

test('24 unidades concluídas acionam checkpoint', () => {
  const studyUnits = studyCycleUnitIds(plan).map((unit_id) => ({ unit_id, status: 'completed' }));
  const progress = deriveStudyCycleProgress({ plan, catalog, studyUnits });
  assert.equal(progress.current, null);
  assert.equal(progress.checkpointDue, true);
  assert.equal(progress.completedSessions, 24);
});
