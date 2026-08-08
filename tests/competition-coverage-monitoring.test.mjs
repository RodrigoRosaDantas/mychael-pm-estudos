import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCoverageSummary, loadCoverageFiles } from '../scripts/check-competition-coverage.mjs';

const { catalog, applicability } = await loadCoverageFiles();
const [packageJson, pagesWorkflow, deploymentScript] = await Promise.all([
  readFile(new URL('../package.json', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/check-public-deployment.mjs', import.meta.url), 'utf8')
]);

test('monitoramento consolida contagem física e vínculos por concurso', () => {
  const summary = buildCoverageSummary(catalog, applicability);
  assert.equal(summary.catalogContentVersion, 34);
  assert.equal(summary.catalogLotId, 'LOT-0037');
  assert.equal(summary.physicalUnits, 34);
  assert.equal(summary.physicalQuestions, 231);
  assert.deepEqual(summary.unitCounts, { PMDF: 34, PMGO: 29, PMMG: 23 });
  assert.deepEqual(summary.questionCounts, { PMDF: 231, PMGO: 196, PMMG: 155 });
  assert.equal(summary.commonUnits, 19);
  assert.equal(summary.commonQuestions, 127);
  assert.equal(summary.pmmgTopicReviewPending, 0);
  assert.equal(summary.specificRotationEnabled, false);
  assert.deepEqual(summary.unclassifiedUnits, []);
});

test('primeira unidade específica PMDF não ativa rotação antes de PMGO e PMMG', () => {
  const rule = applicability.unitApplicability.find((item) => item.unitId === 'U037');
  assert.ok(rule);
  assert.equal(rule.classification, 'specific-rotation');
  assert.deepEqual(rule.competitions, ['PMDF']);
  assert.equal(rule.status, 'verified');
  assert.deepEqual(rule.evidenceIds, ['FNT-0015']);
  assert.equal(applicability.specificRotation.enabled, false);
  assert.equal(buildCoverageSummary(catalog, applicability).specificRotationEnabled, false);
});

test('publicação é bloqueada quando surge unidade sem aplicabilidade explícita', () => {
  const brokenCatalog = structuredClone(catalog);
  brokenCatalog.units.push({ id: 'U999', coverage: ['PMGO', 'PMDF'] });
  assert.throws(() => buildCoverageSummary(brokenCatalog, applicability), /Unidades publicadas sem aplicabilidade explícita: U999/);
});

test('PMMG é bloqueada sem evidência temática explícita', () => {
  const broken = structuredClone(applicability);
  const rule = broken.unitApplicability.find((item) => item.unitId === 'U015');
  rule.competitions.push('PMMG'); rule.status = 'verified'; rule.evidenceIds = [];
  assert.throws(() => buildCoverageSummary(catalog, broken), /U015: PMMG exige evidência temática explícita/);
});

test('classificação common-3 exige os três concursos e evidência', () => {
  const broken = structuredClone(applicability);
  const rule = broken.unitApplicability.find((item) => item.unitId === 'U001');
  rule.competitions = ['PMDF', 'PMGO'];
  assert.throws(() => buildCoverageSummary(catalog, broken), /U001: common-3 deve atender PMDF, PMGO e PMMG/);
});

test('CI e Pages incorporam o gate e os artefatos multi-concurso', () => {
  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts['coverage:check'], 'node scripts/check-competition-coverage.mjs');
  assert.match(pkg.scripts.check, /npm run coverage:check/);
  assert.match(pagesWorkflow, /buildCoverageSummary/); assert.match(pagesWorkflow, /coverage/); assert.match(pagesWorkflow, /GitHub Pages e cobertura multi-concurso validados/);
  for (const path of ['cronograma.html','assets/curriculum-matrix.js','assets/competition-progress.js','content/curriculum-matrix.json','content/content-applicability.json']) assert.match(deploymentScript, new RegExp(path.replace(/[./-]/g, '\\$&')));
});
