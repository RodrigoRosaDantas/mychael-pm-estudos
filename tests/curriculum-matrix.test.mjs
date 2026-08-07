import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [matrixRaw, scheduleHtml, matrixJs] = await Promise.all([
  readFile(new URL('../content/curriculum-matrix.json', import.meta.url), 'utf8'),
  readFile(new URL('../cronograma.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/curriculum-matrix.js', import.meta.url), 'utf8')
]);
const matrix = JSON.parse(matrixRaw);
const byDiscipline = new Map(matrix.disciplines.map((item) => [item.id, item]));
const competitionIds = matrix.competitions.map((item) => item.id);

function present(disciplineId, competitionId) {
  return byDiscipline.get(disciplineId)?.coverage?.[competitionId]?.present === true;
}

test('matriz preserva três concursos e não reclassifica o banco editorial', () => {
  assert.deepEqual(competitionIds, ['PMDF-SOLDADO', 'PMGO-SOLDADO', 'PMMG-SOLDADO']);
  assert.equal(matrix.guardrails.doesNotTagEditorialContent, true);
  assert.equal(matrix.guardrails.weightsAreReferenceOnly, true);
  assert.equal(matrix.guardrails.futureNoticesOverrideReferences, true);
  assert.equal(matrix.cycleModel.finalWeightsStatus, 'pending');
});

test('Português é disciplina autônoma comum aos três editais de referência', () => {
  const portuguese = byDiscipline.get('PORT');
  assert.equal(portuguese.classification, 'common-3');
  for (const id of competitionIds) assert.equal(portuguese.coverage[id].present, true);
});

test('Direito Constitucional é tratado como sobreposição temática e não como bloco idêntico', () => {
  const constitutional = byDiscipline.get('DCON');
  assert.equal(constitutional.classification, 'overlap-3-topic-level');
  for (const id of competitionIds) assert.equal(constitutional.coverage[id].present, true);
  assert.ok(matrix.verifiedTopicOverlaps.some((topic) => topic.id === 'TOP-CONST-FUND' && topic.competitions.length === 3));
});

test('PMMG não herda disciplinas jurídicas autônomas de PMDF e PMGO', () => {
  for (const disciplineId of ['DADM', 'DPEN', 'DPROC-PEN', 'DPEN-MIL', 'DPROC-PEN-MIL']) {
    assert.equal(present(disciplineId, 'PMMG-SOLDADO'), false, `${disciplineId} não deve ser marcado como disciplina PMMG`);
  }
  assert.equal(present('DH', 'PMGO-SOLDADO'), false, 'PMGO não possui bloco explícito de Direitos Humanos no Anexo II de referência');
});

test('PMMG mantém conteúdos próprios sem contaminar os demais concursos', () => {
  assert.equal(present('LIT', 'PMMG-SOLDADO'), true);
  assert.equal(present('LINDB', 'PMMG-SOLDADO'), true);
  assert.equal(present('LIT', 'PMDF-SOLDADO'), false);
  assert.equal(present('LIT', 'PMGO-SOLDADO'), false);
});

test('proveniência da PMMG é transparente enquanto o arquivo oficial direto não foi localizado', () => {
  const pmmg = matrix.competitions.find((item) => item.id === 'PMMG-SOLDADO');
  assert.equal(pmmg.referenceStatus, 'latest-soldier-reference-no-newer-notice-found');
  assert.ok(pmmg.sources.some((source) => source.type === 'reference-notice-copy'));
  assert.equal(pmmg.sources.some((source) => source.type === 'official-notice'), false);
});

test('cronograma carrega a matriz apenas como camada de planejamento', () => {
  assert.match(scheduleHtml, /assets\/curriculum-matrix\.css/);
  assert.match(scheduleHtml, /assets\/curriculum-matrix\.js/);
  assert.match(matrixJs, /content\/curriculum-matrix\.json/);
  assert.match(matrixJs, /percentuais acima descrevem a prova de referência/i);
  assert.doesNotMatch(matrixJs, /content\/catalog\.json/);
  assert.doesNotMatch(matrixJs, /fetch\([^\n]+method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
});
