export const COMPETITIONS = Object.freeze(['PMDF', 'PMGO', 'PMMG']);

export function unitRuleMap(applicability) {
  return new Map((applicability?.unitApplicability ?? []).map((rule) => [rule.unitId, rule]));
}

export function resolveUnitApplicability(applicability, unit, fallbackCoverage = unit?.coverage ?? []) {
  const rule = unitRuleMap(applicability).get(unit?.id);
  if (rule) return rule;
  const competitions = [...new Set((fallbackCoverage ?? []).filter((item) => COMPETITIONS.includes(item)))];
  return {
    unitId: unit?.id ?? null,
    classification: competitions.length >= 2 ? 'legacy-unverified' : 'unclassified',
    competitions,
    status: 'requires-explicit-review',
    evidenceIds: [],
    note: 'Unidade sem regra explícita na camada de aplicabilidade. PMMG nunca é inferida automaticamente.'
  };
}

function latestAttemptsByQuestion(attempts) {
  const latest = new Map();
  for (const attempt of attempts ?? []) {
    if (!attempt?.question_id) continue;
    const previous = latest.get(attempt.question_id);
    if (!previous) {
      latest.set(attempt.question_id, attempt);
      continue;
    }
    const previousAt = new Date(previous.answered_at ?? 0).getTime();
    const currentAt = new Date(attempt.answered_at ?? 0).getTime();
    if (currentAt >= previousAt) latest.set(attempt.question_id, attempt);
  }
  return latest;
}

function percent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function questionUnitMap(catalog) {
  return new Map((catalog?.questions ?? [])
    .filter((question) => question?.id && question?.unitId)
    .map((question) => [question.id, question.unitId]));
}

function openErrorsByUnit(catalog, openErrorQuestionIds = []) {
  const byQuestion = questionUnitMap(catalog);
  const result = new Map();
  for (const questionId of new Set(openErrorQuestionIds ?? [])) {
    const unitId = byQuestion.get(questionId);
    if (!unitId) continue;
    if (!result.has(unitId)) result.set(unitId, []);
    result.get(unitId).push(questionId);
  }
  return result;
}

function buildScope({ id, label, units, completedIds, blockedUnitIds, studyByUnit, questionIds, latestAttempts }) {
  const completed = units.filter((unit) => completedIds.has(unit.id) && !blockedUnitIds.has(unit.id)).length;
  const studiedRows = units.map((unit) => studyByUnit.get(unit.id)).filter(Boolean);
  const masteryValues = studiedRows
    .map((row) => Number(row.mastery_percent))
    .filter((value) => Number.isFinite(value));
  const answered = questionIds.filter((questionId) => latestAttempts.has(questionId));
  const correct = answered.filter((questionId) => latestAttempts.get(questionId)?.is_correct === true).length;
  return {
    id,
    label,
    availableUnits: units.length,
    completedUnits: completed,
    studyPercent: percent(completed, units.length),
    averageMastery: masteryValues.length
      ? Math.round(masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length)
      : null,
    answeredQuestions: answered.length,
    correctQuestions: correct,
    accuracyPercent: answered.length ? percent(correct, answered.length) : null
  };
}

export function computeCompetitionProgress({ catalog, applicability, studyUnits = [], attempts = [], openErrorQuestionIds = [] }) {
  const units = [...(catalog?.units ?? [])];
  const questions = [...(catalog?.questions ?? [])];
  const rules = unitRuleMap(applicability);
  const completedIds = new Set(studyUnits.filter((row) => row.status === 'completed').map((row) => row.unit_id));
  const studyByUnit = new Map(studyUnits.map((row) => [row.unit_id, row]));
  const latestAttempts = latestAttemptsByQuestion(attempts);
  const blockedUnitIds = new Set(openErrorsByUnit(catalog, openErrorQuestionIds).keys());
  const questionsByUnit = new Map();
  for (const question of questions) {
    if (!question?.unitId || !question?.id) continue;
    if (!questionsByUnit.has(question.unitId)) questionsByUnit.set(question.unitId, []);
    questionsByUnit.get(question.unitId).push(question.id);
  }

  const unitsForCompetition = (competition) => units.filter((unit) => {
    const rule = rules.get(unit.id) ?? resolveUnitApplicability(applicability, unit);
    return rule.competitions.includes(competition);
  });
  const questionsForUnits = (scopeUnits) => scopeUnits.flatMap((unit) => questionsByUnit.get(unit.id) ?? []);

  const commonUnits = units.filter((unit) => rules.get(unit.id)?.classification === 'common-3');
  const scopes = [
    buildScope({
      id: 'COMMON',
      label: 'Núcleo comum',
      units: commonUnits,
      completedIds,
      blockedUnitIds,
      studyByUnit,
      questionIds: questionsForUnits(commonUnits),
      latestAttempts
    }),
    ...COMPETITIONS.map((competition) => {
      const scopeUnits = unitsForCompetition(competition);
      return buildScope({
        id: competition,
        label: competition,
        units: scopeUnits,
        completedIds,
        blockedUnitIds,
        studyByUnit,
        questionIds: questionsForUnits(scopeUnits),
        latestAttempts
      });
    })
  ];

  return {
    scopes,
    publishedUnits: units.length,
    explicitlyClassifiedUnits: units.filter((unit) => rules.has(unit.id)).length,
    pendingClassificationUnits: units.filter((unit) => !rules.has(unit.id)).map((unit) => unit.id),
    blockedUnitIds: [...blockedUnitIds]
  };
}

export function nextGuidedStep({ catalog, applicability, studyUnits = [], openErrorQuestionIds = [] }) {
  const units = [...(catalog?.units ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const completedIds = new Set(studyUnits.filter((row) => row.status === 'completed').map((row) => row.unit_id));
  const rules = unitRuleMap(applicability);
  const errorsByUnit = openErrorsByUnit(catalog, openErrorQuestionIds);

  const correctionUnit = units.find((unit) => errorsByUnit.has(unit.id));
  if (correctionUnit) {
    const pendingErrors = errorsByUnit.get(correctionUnit.id).length;
    return {
      phase: 'correction',
      phaseLabel: 'Corrigir antes de avançar',
      unit: correctionUnit,
      pendingErrors,
      message: `${pendingErrors} questão(ões) ainda precisam de correção nesta unidade. Resolva as pendências antes de abrir conteúdo novo.`
    };
  }

  const firstIncomplete = (classification) => units.find((unit) => {
    const rule = rules.get(unit.id);
    return rule?.classification === classification && !completedIds.has(unit.id);
  });

  const common = firstIncomplete('common-3');
  if (common) {
    return {
      phase: 'common-3',
      phaseLabel: 'Núcleo comum aos três',
      unit: common,
      message: 'Continue primeiro pelo conteúdo verificado como comum a PMDF, PMGO e PMMG.'
    };
  }

  const shared = firstIncomplete('shared-2');
  if (shared) {
    return {
      phase: 'shared-2',
      phaseLabel: 'Convergência entre dois concursos',
      unit: shared,
      message: 'O núcleo comum publicado foi concluído. Avance agora pelos conteúdos compartilhados por dois concursos.'
    };
  }

  if (applicability?.specificRotation?.enabled) {
    return {
      phase: 'specific-rotation',
      phaseLabel: 'Específicas em rotação',
      unit: null,
      message: 'A etapa seguinte é a rotação específica PMDF → PMGO → PMMG.'
    };
  }

  return {
    phase: 'waiting-editorial-coverage',
    phaseLabel: 'Aguardando cobertura editorial',
    unit: null,
    message: applicability?.specificRotation?.reason ?? 'A rotação específica ainda não foi ativada.'
  };
}
