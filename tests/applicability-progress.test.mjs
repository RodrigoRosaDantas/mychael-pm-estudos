import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  computeCompetitionProgress,
  nextGuidedStep,
  resolveUnitApplicability
} from '../assets/applicability-core.js';

const applicability = JSON.parse(await readFile(new URL('../content/content-applicability.json', import.meta.url), 'utf8'));
const [studyHtml, subjectsHtml, scheduleHtml, performanceHtml, uiModule] = await Promise.all([
  readFile(new URL('../estudar.html', import.meta.url), 'utf8'),
  readFile(new URL('../materias.html', import.meta.url), 'utf8'),
  readFile(new URL('../cronograma.html', import.meta.url), 'utf8'),
  readFile(new URL('../desempenho.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/competition-progress.js', import.meta.url), 'utf8')
]);

test('camada de aplicabilidade preserva guardrails e não infere PMMG', () => {
  assert.equal(applicability.guardrails.separateFromEditorialCatalog, true);
  assert.equal(applicability.guardrails.pmmgRequiresExplicitTopicVerification, true);
  assert.equal(applicability.guardrails.unknownFutureUnitsDefaultToNoPmmg, true);
  assert.equal(applicability.guardrails.doesNotRepresentPercentOfFullNotice, true);

  const ids = applicability.unitApplicability.map((rule) => rule.unitId);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(
    applicability.unitApplicability
      .filter((rule) => rule.classification === 'common-3')
      .map((rule) => rule.unitId),
    ['U001', 'U002', 'U003', 'U004', 'U005', 'U008', 'U009', 'U020', 'U021', 'U022', 'U023', 'U024']
  );

  for (const id of ['U006', 'U007', 'U013', 'U015', 'U016', 'U017', 'U018', 'U019']) {
    const rule = applicability.unitApplicability.find((item) => item.unitId === id);
    assert.ok(rule, `regra ausente para ${id}`);
    assert.equal(rule.competitions.includes('PMMG'), false, `${id} não pode herdar PMMG automaticamente`);
  }
});

test('unidade futura sem regra explícita nunca recebe PMMG por inferência', () => {
  const rule = resolveUnitApplicability(applicability, { id: 'U999', coverage: ['PMGO', 'PMDF'] });
  assert.deepEqual(rule.competitions, ['PMGO', 'PMDF']);
  assert.equal(rule.status, 'requires-explicit-review');
  assert.equal(rule.competitions.includes('PMMG'), false);
});

test('progresso por concurso usa unidade aplicável e tentativa mais recente por questão', () => {
  const catalog = { units: [{ id: 'U001', order: 10, coverage: ['PMGO', 'PMDF'] }, { id: 'U015', order: 20, coverage: ['PMGO', 'PMDF'] }, { id: 'U999', order: 30, coverage: ['PMGO', 'PMDF'] }], questions: [{ id: 'Q1', unitId: 'U001' }, { id: 'Q2', unitId: 'U015' }, { id: 'Q3', unitId: 'U999' }] };
  const studyUnits = [{ unit_id: 'U001', status: 'completed', mastery_percent: 90 }, { unit_id: 'U015', status: 'in_progress', mastery_percent: 50 }];
  const attempts = [{ question_id: 'Q1', is_correct: false, answered_at: '2026-08-07T10:00:00Z' }, { question_id: 'Q1', is_correct: true, answered_at: '2026-08-07T11:00:00Z' }, { question_id: 'Q2', is_correct: false, answered_at: '2026-08-07T11:30:00Z' }];
  const model = computeCompetitionProgress({ catalog, applicability, studyUnits, attempts });
  const byId = new Map(model.scopes.map((scope) => [scope.id, scope]));
  assert.equal(byId.get('COMMON').availableUnits, 1);
  assert.equal(byId.get('COMMON').studyPercent, 100);
  assert.equal(byId.get('PMMG').availableUnits, 1);
  assert.equal(byId.get('PMMG').studyPercent, 100);
  assert.equal(byId.get('PMDF').availableUnits, 3);
  assert.equal(byId.get('PMDF').studyPercent, 33);
  assert.equal(byId.get('PMDF').answeredQuestions, 2);
  assert.equal(byId.get('PMDF').accuracyPercent, 50);
  assert.equal(byId.get('PMGO').accuracyPercent, 50);
});

test('erro aberto impede que unidade marcada completed conte como concluída', () => {
  const catalog = {
    units: [{ id: 'U001', order: 10, coverage: ['PMGO', 'PMDF'] }],
    questions: [{ id: 'Q1', unitId: 'U001' }]
  };
  const model = computeCompetitionProgress({
    catalog,
    applicability,
    studyUnits: [{ unit_id: 'U001', status: 'completed', mastery_percent: 100 }],
    attempts: [{ question_id: 'Q1', is_correct: false, answered_at: '2026-08-07T11:00:00Z' }],
    openErrorQuestionIds: ['Q1']
  });
  const common = model.scopes.find((scope) => scope.id === 'COMMON');
  assert.equal(common.completedUnits, 0);
  assert.equal(common.studyPercent, 0);
  assert.deepEqual(model.blockedUnitIds, ['U001']);
});

test('próximo passo prioriza correção antes de qualquer conteúdo novo', () => {
  const catalog = {
    units: [
      { id: 'U001', order: 10, title: 'Primeira comum' },
      { id: 'U002', order: 20, title: 'Segunda comum' },
      { id: 'U015', order: 30, title: 'Penal compartilhado' }
    ],
    questions: [
      { id: 'Q1', unitId: 'U001' },
      { id: 'Q2', unitId: 'U001' },
      { id: 'Q3', unitId: 'U002' }
    ]
  };
  const studyUnits = [{ unit_id: 'U001', status: 'completed' }];
  const correction = nextGuidedStep({ catalog, applicability, studyUnits, openErrorQuestionIds: ['Q2'] });
  assert.equal(correction.phase, 'correction');
  assert.equal(correction.phaseLabel, 'Corrigir antes de avançar');
  assert.equal(correction.unit.id, 'U001');
  assert.equal(correction.pendingErrors, 1);
  const afterCorrection = nextGuidedStep({ catalog, applicability, studyUnits, openErrorQuestionIds: [] });
  assert.equal(afterCorrection.phase, 'common-3');
  assert.equal(afterCorrection.unit.id, 'U002');
});

test('entre vários erros o ciclo escolhe primeiro a unidade pedagogicamente mais antiga', () => {
  const catalog = {
    units: [
      { id: 'U001', order: 10, title: 'Primeira comum' },
      { id: 'U002', order: 20, title: 'Segunda comum' }
    ],
    questions: [
      { id: 'Q1', unitId: 'U001' },
      { id: 'Q2', unitId: 'U002' }
    ]
  };
  const step = nextGuidedStep({ catalog, applicability, studyUnits: [], openErrorQuestionIds: ['Q2', 'Q1', 'Q999'] });
  assert.equal(step.phase, 'correction');
  assert.equal(step.unit.id, 'U001');
  assert.equal(step.pendingErrors, 1);
});

test('próximo passo respeita núcleo comum antes de convergência por dois quando não há erro', () => {
  const catalog = { units: [{ id: 'U001', order: 10, title: 'Primeira comum' }, { id: 'U002', order: 20, title: 'Segunda comum' }, { id: 'U015', order: 30, title: 'Penal compartilhado' }], questions: [] };
  const first = nextGuidedStep({ catalog, applicability, studyUnits: [] });
  assert.equal(first.phase, 'common-3');
  assert.equal(first.unit.id, 'U001');
  const afterFirst = nextGuidedStep({ catalog, applicability, studyUnits: [{ unit_id: 'U001', status: 'completed' }] });
  assert.equal(afterFirst.phase, 'common-3');
  assert.equal(afterFirst.unit.id, 'U002');
  const afterCommon = nextGuidedStep({ catalog, applicability, studyUnits: [{ unit_id: 'U001', status: 'completed' }, { unit_id: 'U002', status: 'completed' }] });
  assert.equal(afterCommon.phase, 'shared-2');
  assert.equal(afterCommon.unit.id, 'U015');
});

test('páginas relevantes carregam a camada multi-concurso sem segredo elevado', () => {
  for (const html of [studyHtml, subjectsHtml, scheduleHtml, performanceHtml]) assert.match(html, /competition-progress\.js/);
  assert.match(uiModule, /content\/content-applicability\.json/);
  assert.match(uiModule, /question_attempts/);
  assert.match(uiModule, /study_units/);
  assert.match(uiModule, /error_items/);
  assert.match(uiModule, /Corrigir erros pendentes/);
  assert.match(uiModule, /mode=errors/);
  assert.doesNotMatch(uiModule, /service_role|sb_secret_/i);
});
