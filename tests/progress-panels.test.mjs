import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, panels, css, deploymentCheck, staticCheck] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/progress-panels.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/progress-panels.css', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/check-public-deployment.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/check-static.mjs', import.meta.url), 'utf8')
]);

test('página possui painéis privados de revisão, erros e desempenho', () => {
  for (const id of ['reviewWorkspace', 'errorWorkspace', 'performanceWorkspace']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /assets\/progress-panels\.js/);
  assert.match(html, /assets\/progress-panels\.css/);
});

test('módulo consulta somente tabelas privadas necessárias', () => {
  for (const table of ['review_items', 'error_items', 'question_attempts', 'study_units']) {
    assert.ok(panels.includes(`from('${table}')`));
  }
  assert.doesNotMatch(panels, /signUp\s*\(|service_role|sb_secret_/i);
});

test('erro agenda revisão e resposta correta preserva o fluxo', () => {
  assert.match(panels, /ensureReview/);
  assert.match(panels, /resolveErrors/);
  assert.match(panels, /completeDueReview/);
  assert.match(panels, /86_400_000/);
  assert.match(panels, /status: 'resolved'/);
  assert.match(panels, /status: 'completed'/);
});

test('painéis calculam indicadores sem expor identidade', () => {
  assert.match(panels, /totalAttempts/);
  assert.match(panels, /accuracy/);
  assert.match(panels, /completedUnits/);
  assert.match(panels, /openErrors/);
  assert.match(panels, /pendingReviews/);
  assert.doesNotMatch(panels, /session\.user\.email|sessionEmail|user\.id/);
});

test('smoke test e validação estática exigem os novos módulos', () => {
  for (const path of ['assets/progress-panels.js', 'assets/progress-panels.css']) {
    assert.ok(deploymentCheck.includes(`'${path}'`));
    assert.ok(staticCheck.includes(`'${path}'`));
  }
  assert.match(deploymentCheck, /id="reviewWorkspace"/);
  assert.match(deploymentCheck, /id="errorWorkspace"/);
  assert.match(deploymentCheck, /id="performanceWorkspace"/);
});

test('estilos cobrem componentes privados e responsividade', () => {
  for (const selector of ['.private-panel', '.private-list', '.performance-grid', '.review-target']) {
    assert.ok(css.includes(selector));
  }
  assert.match(css, /@media\(max-width:760px\)/);
});
