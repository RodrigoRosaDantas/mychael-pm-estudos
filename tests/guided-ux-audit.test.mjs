import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [homeHtml, performanceHtml, scheduleHtml, guidedModule] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../desempenho.html', import.meta.url), 'utf8'),
  readFile(new URL('../cronograma.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/guided-ux.js', import.meta.url), 'utf8')
]);

test('home, desempenho e cronograma carregam a correção progressiva de UX', () => {
  for (const html of [homeHtml, performanceHtml, scheduleHtml]) {
    assert.match(html, /assets\/guided-ux\.js/);
  }
});

test('home autenticada usa o próximo passo real do ciclo em vez da primeira unidade estática', () => {
  assert.match(guidedModule, /nextGuidedStep/);
  assert.match(guidedModule, /study_units/);
  assert.match(guidedModule, /Próximo passo do seu ciclo/);
  assert.match(guidedModule, /Continuar próximo passo/);
  assert.match(guidedModule, /estudar\.html\?unit=/);
  assert.doesNotMatch(guidedModule, /service_role|sb_secret_/i);
});

test('desempenho usa a tentativa mais recente de cada questão', () => {
  assert.match(guidedModule, /latestAttemptsByQuestion/);
  assert.match(guidedModule, /answered_at/);
  assert.match(guidedModule, /questões respondidas/);
  assert.match(guidedModule, /acerto atual · última tentativa/);
  assert.match(guidedModule, /question_attempts/);
});

test('cronograma informa que a matriz já está estruturada e mantém pesos pendentes', () => {
  assert.match(guidedModule, /matriz curricular PMDF × PMGO × PMMG já está estruturada/i);
  assert.match(guidedModule, /cobertura editorial representativa/i);
  assert.match(guidedModule, /pesos definitivos/i);
  assert.match(guidedModule, /precisão falsa/i);
});
