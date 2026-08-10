import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const unitReview = await readFile(new URL('../assets/unit-review.js', import.meta.url), 'utf8');
const questionsPage = await readFile(new URL('../questoes.html', import.meta.url), 'utf8');
const reviewsPage = await readFile(new URL('../revisoes.html', import.meta.url), 'utf8');
const studyPage = await readFile(new URL('../estudar.html', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

test('unidade concluída entra em revisão espaçada sem duplicar registro', () => {
  assert.match(unitReview, /eq\('status', 'completed'\)/);
  assert.match(unitReview, /source_type: 'unit'/);
  assert.match(unitReview, /reason: 'unit_completed'/);
  assert.match(unitReview, /completed_at \? new Date\(unit\.completed_at\) : new Date\(\)/);
  assert.match(unitReview, /ignoreDuplicates: true/);
});

test('revisão de unidade respeita erros abertos e avança pelas âncoras', () => {
  assert.match(unitReview, /openErrorsForUnit/);
  assert.match(unitReview, /Corrigir erro primeiro/);
  assert.match(unitReview, /nextReviewInterval\(review\.interval_days/);
  assert.match(unitReview, /nextReviewAt\(intervalDays, now\)/);
});

test('fluxo de revisão por unidade está ligado às páginas necessárias', () => {
  for (const html of [questionsPage, reviewsPage, studyPage]) {
    assert.match(html, /assets\/unit-review\.js/);
  }
});

test('README registra o catálogo cumulativo v41 vigente', () => {
  assert.match(readme, /versão 41/);
  assert.match(readme, /41 unidades/);
  assert.match(readme, /280 questões/);
  assert.match(readme, /PMDF: 37 unidades \/ 252 questões/);
  assert.match(readme, /PMGO: 33 unidades \/ 224 questões/);
});
