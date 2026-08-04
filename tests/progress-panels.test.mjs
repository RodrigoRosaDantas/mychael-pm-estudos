import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [site, errorsPage, reviewsPage, performancePage, deploymentCheck, staticCheck] = await Promise.all([
  readFile(new URL('../assets/site.js', import.meta.url), 'utf8'),
  readFile(new URL('../erros.html', import.meta.url), 'utf8'),
  readFile(new URL('../revisoes.html', import.meta.url), 'utf8'),
  readFile(new URL('../desempenho.html', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/check-public-deployment.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/check-static.mjs', import.meta.url), 'utf8')
]);

test('erros, revisões e desempenho possuem páginas próprias', () => {
  assert.match(errorsPage, /data-page="errors"/);
  assert.match(reviewsPage, /data-page="reviews"/);
  assert.match(performancePage, /data-page="performance"/);
});

test('módulo consulta somente tabelas privadas necessárias', () => {
  for (const table of ['review_items', 'error_items', 'question_attempts', 'study_units']) assert.ok(site.includes(`from('${table}')`));
  assert.doesNotMatch(site, /signUp\s*\(|service_role|sb_secret_/i);
});

test('caderno permite refazer todas ou uma questão específica', () => {
  assert.match(site, /Refazer todas/);
  assert.match(site, /Refazer esta questão/);
  assert.match(site, /loadOpenErrorQuestionIds/);
  assert.match(site, /mode: 'errors'/);
  assert.match(site, /question: question\.id/);
});

test('acerto resolve o erro e preserva a tentativa', () => {
  assert.match(site, /async function resolveError/);
  assert.match(site, /status: 'resolved'/);
  assert.match(site, /status: 'completed'/);
  assert.match(site, /from\('question_attempts'\)\.insert/);
  assert.doesNotMatch(site, /delete\(\).*question_attempts/s);
});

test('novo erro não duplica pendência aberta', () => {
  assert.match(site, /async function registerError/);
  assert.match(site, /\.in\('status', \['open', 'reviewing'\]\)/);
  assert.match(site, /maybeSingle\(\)/);
  assert.match(site, /scheduleReview/);
});

test('smoke e validação estática exigem páginas e fluxo de erros', () => {
  for (const path of ['questoes.html', 'revisoes.html', 'erros.html', 'desempenho.html', 'assets/site.js']) {
    assert.ok(deploymentCheck.includes(`'${path}'`), `Smoke sem ${path}.`);
    assert.ok(staticCheck.includes(`'${path}'`), `Validação sem ${path}.`);
  }
  assert.match(deploymentCheck, /loadOpenErrorQuestionIds/);
  assert.match(staticCheck, /Refazer todas/);
});
