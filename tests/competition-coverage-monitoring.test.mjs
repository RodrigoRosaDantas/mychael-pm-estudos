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
  assert.equal(summary.catalogContentVersion, 47);
  assert.equal(summary.catalogLotId, 'LOT-0048');
  assert.equal(summary.physicalUnits, 47);
  assert.equal(summary.physicalQuestions, 322);
  assert.deepEqual(summary.unitCounts, { PMDF: 43, PMGO: 35, PMMG: 30 });
  assert.deepEqual(summary.questionCounts, { PMDF: 294, PMGO: 238, PMMG: 204 });
  assert.equal(summary.commonUnits, 19);
  assert.equal(summary.commonQuestions, 127);
  assert.equal(summary.pmmgTopicReviewPending, 0);
  assert.equal(summary.specificRotationEnabled, false);
  assert.deepEqual(summary.unclassifiedUnits, []);
});

test('lotes históricos recuperados têm aplicabilidade explícita PMDF + PMGO', () => {
  for (const unitId of ['U011','U012','U014']) {
    const rule = applicability.unitApplicability.find((item) => item.unitId === unitId);
    assert.ok(rule, `${unitId} sem aplicabilidade`);
    assert.equal(rule.classification, 'shared-2');
    assert.deepEqual(rule.competitions, ['PMDF','PMGO']);
    assert.equal(rule.status, 'verified-not-pmmg');
  }
});

test('LOT-0043 a LOT-0048 têm aplicabilidade explícita e não ativam rotação específica', () => {
  const expected = {
    U042: ['PMDF','PMMG'],
    U043: ['PMDF','PMMG'],
    U044: ['PMDF','PMMG'],
    U045: ['PMDF','PMGO'],
    U046: ['PMDF','PMGO'],
    U047: ['PMDF','PMMG']
  };
  for (const [unitId, competitions] of Object.entries(expected)) {
    const rule = applicability.unitApplicability.find((item) => item.unitId === unitId);
    assert.ok(rule, `${unitId} sem aplicabilidade`);
    assert.equal(rule.classification, 'shared-2');
    assert.deepEqual(rule.competitions, competitions);
    assert.ok(rule.evidenceIds.length > 0, `${unitId} sem evidência`);
  }
  assert.equal(applicability.specificRotation.enabled, false);
});

test('primeiras específicas PMDF, PMGO e PMMG permanecem com rotação definitiva desativada até O7', () => {
  const pmdf = applicability.unitApplicability.find((item) => item.unitId === 'U037');
  const pmgo = applicability.unitApplicability.find((item) => item.unitId === 'U038');
  const pmmg = applicability.unitApplicability.find((item) => item.unitId === 'U039');
  assert.ok(pmdf); assert.equal(pmdf.classification, 'specific-rotation'); assert.deepEqual(pmdf.competitions, ['PMDF']); assert.deepEqual(pmdf.evidenceIds, ['FNT-0015']);
  assert.ok(pmgo); assert.equal(pmgo.classification, 'specific-rotation'); assert.deepEqual(pmgo.competitions, ['PMGO']); assert.deepEqual(pmgo.evidenceIds, ['FNT-0014']);
  assert.ok(pmmg); assert.equal(pmmg.classification, 'specific-rotation'); assert.deepEqual(pmmg.competitions, ['PMMG']); assert.deepEqual(pmmg.evidenceIds, ['FNT-0025','FNT-0026']);
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
