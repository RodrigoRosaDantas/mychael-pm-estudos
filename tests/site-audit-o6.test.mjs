import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  site,
  enhancements,
  client,
  progressPanels,
  competitionProgress,
  tafPage,
  scheduleHtml,
  readme
] = await Promise.all([
  readFile(new URL('../assets/site.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/enhancements.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/supabase-client.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/progress-panels.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/competition-progress.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/taf-page.js', import.meta.url), 'utf8'),
  readFile(new URL('../cronograma.html', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8')
]);

test('rodapé e datas privadas usam explicitamente o horário de Brasília', () => {
  assert.match(enhancements, /const BRASILIA_TIME_ZONE = 'America\/Sao_Paulo'/);
  assert.match(enhancements, /timeZone: BRASILIA_TIME_ZONE/);
  assert.match(site, /timeZone: 'America\/Sao_Paulo'/);
  assert.match(tafPage, /timeZone: 'America\/Sao_Paulo'/);
});

test('home conta as referências históricas de TAF realmente publicadas', () => {
  assert.match(site, /taf-pmmg-historical\.json/);
  assert.match(site, /Array\.isArray\(payload\.records\) \? payload\.records\.length : 0/);
  assert.match(site, /referências históricas de TAF/);
});

test('interface preserva a rotação específica desativada até O7', () => {
  assert.match(enhancements, /Específicas aguardam calibração/);
  assert.match(enhancements, /Rotação específica ainda desativada/);
  assert.match(enhancements, /só será ativada no O7/);
  assert.match(scheduleHtml, /rotação específica somente após calibração/);
  assert.doesNotMatch(enhancements, /Primeiro o que é comum\. Depois, específicas em rotação\./);
});

test('aplicabilidade específica tem rótulo e semântica acessível corretos', () => {
  assert.match(competitionProgress, /specific-rotation/);
  assert.match(competitionProgress, /Específica de uma corporação/);
  assert.match(competitionProgress, /aria-label="\$\{COMPETITION_LABELS\[competition\]\}: \$\{accessibleStatus\}"/);
  assert.match(competitionProgress, /não se aplica/);
});

test('Supabase usa uma única instância de navegador e versão fixada', () => {
  assert.match(client, /@supabase\/supabase-js@2\.112\.2/);
  assert.match(client, /const clientCache = new Map\(\)/);
  assert.match(client, /if \(cached\) return cached/);
  assert.match(progressPanels, /from '.\/supabase-client\.js'/);
  assert.doesNotMatch(progressPanels, /https:\/\/esm\.sh\/\@supabase/);
});

test('simulados explicam o gate documental e a tela do TAF esconde ID técnico', () => {
  assert.match(site, /documentação oficial apta/);
  assert.doesNotMatch(site, /depois da formação de uma base mínima/);
  assert.doesNotMatch(tafPage, /STU-MYCHAEL/);
});

test('documentação técnica acompanha catálogo v41 e provas históricas do O6', () => {
  assert.match(readme, /versão 41/);
  assert.match(readme, /41 unidades/);
  assert.match(readme, /280 questões/);
  assert.match(readme, /metadados históricos de quatro provas/);
});