import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, script, css, readme] = await Promise.all([
  readFile(new URL('../taf.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/taf-page.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/taf.css', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8')
]);

test('página TAF carrega o shell e o módulo funcional dedicado', () => {
  assert.match(html, /assets\/site\.js/);
  assert.match(html, /assets\/taf-page\.js/);
  assert.match(html, /assets\/taf\.css/);
  assert.ok(html.indexOf('assets/site.js') < html.indexOf('assets/taf-page.js'));
});

test('módulo TAF usa o contrato real do perfil Supabase', () => {
  assert.match(script, /\.select\('id, is_active'\)/);
  assert.match(script, /profile\?\.is_active === true/);
  assert.doesNotMatch(script, /\.select\('id, status'\)/);
  assert.doesNotMatch(script, /profile\?\.status/);
});

test('módulo TAF grava somente no armazenamento privado previsto', () => {
  assert.match(script, /from\('taf_attempts'\)/);
  assert.match(script, /profile_id:\s*supabaseConfig\.profileId/);
  assert.match(script, /reference_id:\s*null/);
  assert.match(script, /client_event_id:\s*crypto\.randomUUID\(\)/);
  assert.doesNotMatch(script, /\.update\(/);
  assert.doesNotMatch(script, /\.delete\(/);
});

test('módulo não apresenta índice oficial como vigente', () => {
  assert.match(script, /não publica índice oficial vigente/i);
  assert.match(script, /Índice histórico não é índice vigente/i);
  assert.match(script, /treino não comprova aptidão/i);
  assert.doesNotMatch(script, /meta oficial/i);
});

test('segurança, privacidade e responsividade estão explícitas', () => {
  assert.match(script, /não substitui avaliação médica/i);
  assert.match(script, /não são enviados ao GitHub nem ao Notion/i);
  assert.doesNotMatch(script, /STU-MYCHAEL/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(readme, /registros pessoais de treino permanecem no Supabase/i);
});
