import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const COMPETITIONS = Object.freeze(['PMDF', 'PMGO', 'PMMG']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function buildCoverageSummary(catalog, applicability) {
  assert(Array.isArray(catalog?.units), 'Catálogo sem unidades.');
  assert(Array.isArray(catalog?.questions), 'Catálogo sem questões.');
  assert(Array.isArray(applicability?.unitApplicability), 'Camada de aplicabilidade sem regras de unidade.');

  const unitsById = new Map(catalog.units.map((unit) => [unit.id, unit]));
  const rulesById = new Map();
  for (const rule of applicability.unitApplicability) {
    assert(rule?.unitId, 'Regra de aplicabilidade sem unitId.');
    assert(!rulesById.has(rule.unitId), `Regra de aplicabilidade duplicada: ${rule.unitId}.`);
    assert(unitsById.has(rule.unitId), `Regra aponta para unidade inexistente: ${rule.unitId}.`);
    assert(Array.isArray(rule.competitions), `${rule.unitId}: competitions inválido.`);
    assert(rule.competitions.length > 0, `${rule.unitId}: nenhuma competição atribuída.`);
    assert(rule.competitions.every((competition) => COMPETITIONS.includes(competition)), `${rule.unitId}: competição desconhecida.`);
    if (rule.classification === 'common-3') {
      assert(COMPETITIONS.every((competition) => rule.competitions.includes(competition)), `${rule.unitId}: common-3 deve atender PMDF, PMGO e PMMG.`);
      assert(rule.status === 'verified', `${rule.unitId}: common-3 deve estar verificado.`);
      assert((rule.evidenceIds ?? []).length > 0, `${rule.unitId}: common-3 precisa de evidência explícita.`);
    }
    if (rule.competitions.includes('PMMG')) {
      assert(rule.status === 'verified', `${rule.unitId}: PMMG só pode ser atribuída com status verified.`);
      assert((rule.evidenceIds ?? []).length > 0, `${rule.unitId}: PMMG exige evidência temática explícita.`);
    }
    rulesById.set(rule.unitId, rule);
  }

  const unclassifiedUnits = catalog.units.filter((unit) => !rulesById.has(unit.id)).map((unit) => unit.id);
  assert(unclassifiedUnits.length === 0, `Unidades publicadas sem aplicabilidade explícita: ${unclassifiedUnits.join(', ')}.`);

  const questionCounts = Object.fromEntries(COMPETITIONS.map((competition) => [competition, 0]));
  const unitCounts = Object.fromEntries(COMPETITIONS.map((competition) => [competition, 0]));
  const questionIds = new Set();
  const questionsByUnit = new Map();
  for (const question of catalog.questions) {
    assert(question?.id, 'Questão sem id no catálogo.');
    assert(!questionIds.has(question.id), `Questão duplicada: ${question.id}.`);
    questionIds.add(question.id);
    assert(unitsById.has(question.unitId), `${question.id}: unitId inexistente ${question.unitId}.`);
    if (!questionsByUnit.has(question.unitId)) questionsByUnit.set(question.unitId, []);
    questionsByUnit.get(question.unitId).push(question.id);
  }

  let commonUnits = 0;
  let commonQuestions = 0;
  let pmmgTopicReviewPending = 0;
  for (const unit of catalog.units) {
    const rule = rulesById.get(unit.id);
    const unitQuestionCount = (questionsByUnit.get(unit.id) ?? []).length;
    if (rule.classification === 'common-3') {
      commonUnits += 1;
      commonQuestions += unitQuestionCount;
    }
    if (rule.status === 'pmmg-topic-review-needed') pmmgTopicReviewPending += 1;
    for (const competition of rule.competitions) {
      unitCounts[competition] += 1;
      questionCounts[competition] += unitQuestionCount;
    }
  }

  return {
    schemaVersion: applicability.schemaVersion ?? null,
    reviewedAt: applicability.reviewedAt ?? null,
    catalogContentVersion: catalog.contentVersion ?? null,
    catalogLotId: catalog.publication?.lotId ?? null,
    physicalUnits: catalog.units.length,
    physicalQuestions: catalog.questions.length,
    unitCounts,
    questionCounts,
    commonUnits,
    commonQuestions,
    pmmgTopicReviewPending,
    specificRotationEnabled: applicability.specificRotation?.enabled === true,
    unclassifiedUnits: []
  };
}

export async function loadCoverageFiles(root = new URL('../', import.meta.url)) {
  const [catalog, applicability] = await Promise.all([
    readFile(new URL('content/catalog.json', root), 'utf8').then(JSON.parse),
    readFile(new URL('content/content-applicability.json', root), 'utf8').then(JSON.parse)
  ]);
  return { catalog, applicability };
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  loadCoverageFiles()
    .then(({ catalog, applicability }) => buildCoverageSummary(catalog, applicability))
    .then((summary) => console.log(JSON.stringify({ status: 'coverage-ok', ...summary })))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
