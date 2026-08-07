import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [homeHtml, performanceHtml, scheduleHtml, questionsHtml, settingsHtml, guidedModule, cycleSyncModule] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../desempenho.html', import.meta.url), 'utf8'),
  readFile(new URL('../cronograma.html', import.meta.url), 'utf8'),
  readFile(new URL('../questoes.html', import.meta.url), 'utf8'),
  readFile(new URL('../configuracoes.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/guided-ux.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/cycle-progress-sync.js', import.meta.url), 'utf8')
]);

test('páginas auditadas carregam a correção progressiva de UX', () => {
  for (const html of [homeHtml, performanceHtml, scheduleHtml, questionsHtml, settingsHtml]) {
    assert.match(html, /assets\/guided-ux\.js/);
  }
  assert.match(questionsHtml, /assets\/cycle-progress-sync\.js/);
});

test('home autenticada usa o próximo passo real do ciclo em vez da primeira unidade estática', () => {
  assert.match(guidedModule, /nextGuidedStep/);
  assert.match(guidedModule, /study_units/);
  assert.match(guidedModule, /Próximo passo do seu ciclo/);
  assert.match(guidedModule, /Continuar próximo passo/);
  assert.match(guidedModule, /estudar\.html\?unit=/);
  assert.match(guidedModule, /if \(!hero \|\| !nextCopy\) return/);
  assert.doesNotMatch(guidedModule, /service_role|sb_secret_/i);
});

test('home prioriza erros abertos e oferece correção antes de teoria nova', () => {
  assert.match(guidedModule, /error_items/);
  assert.match(guidedModule, /openErrorQuestionIds/);
  assert.match(guidedModule, /step\.phase === 'correction'/);
  assert.match(guidedModule, /Corrigir erros pendentes/);
  assert.match(guidedModule, /mode=errors/);
  assert.match(guidedModule, /Rever teoria/);
});

test('desempenho usa a tentativa mais recente de cada questão', () => {
  assert.match(guidedModule, /latestAttemptsByQuestion/);
  assert.match(guidedModule, /answered_at/);
  assert.match(guidedModule, /questões respondidas/);
  assert.match(guidedModule, /acerto atual · última tentativa/);
  assert.match(guidedModule, /question_attempts/);
});

test('sincronizador só conclui unidade com todas as últimas respostas corretas e sem erro aberto', () => {
  assert.match(cycleSyncModule, /latestAttemptsByQuestion/);
  assert.match(cycleSyncModule, /error_items/);
  assert.match(cycleSyncModule, /answered === questionIds\.length && correct === questionIds\.length && !hasOpenError/);
  assert.match(cycleSyncModule, /desiredStatus = completed \? 'completed'/);
  assert.match(cycleSyncModule, /completed_at: completed/);
  assert.doesNotMatch(cycleSyncModule, /service_role|sb_secret_/i);
});

test('questão correta fora da refação não afirma que havia erro pendente', () => {
  assert.match(guidedModule, /alignQuestionFeedback/);
  assert.match(guidedModule, /Correto\. Tentativa salva\./);
  assert.match(guidedModule, /mode.*errors/);
});

test('configurações escondem identificadores e infraestrutura do estudante', () => {
  assert.match(guidedModule, /Perfil de estudo/);
  assert.match(guidedModule, /Individual e privado/);
  assert.match(guidedModule, /Salvo de forma privada na sua conta/);
  assert.match(guidedModule, /Sua sessão está ativa e o progresso pode ser salvo com privacidade/);
});

test('cronograma informa que a matriz já está estruturada e mantém pesos pendentes', () => {
  assert.match(guidedModule, /matriz curricular PMDF × PMGO × PMMG já está estruturada/i);
  assert.match(guidedModule, /cobertura editorial representativa/i);
  assert.match(guidedModule, /pesos definitivos/i);
  assert.match(guidedModule, /precisão falsa/i);
});
