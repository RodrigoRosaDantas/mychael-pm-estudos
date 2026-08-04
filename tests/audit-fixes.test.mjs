import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const [site, client, readme, ci, config, e2e] = await Promise.all([
  readFile(new URL('../assets/site.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/supabase-client.js', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  readFile(new URL('../playwright.config.mjs', import.meta.url), 'utf8'),
  readFile(new URL('./e2e/error-notebook.spec.mjs', import.meta.url), 'utf8')
]);

test('refação não reutiliza tentativa anterior para revelar resposta', () => {
  assert.match(site, /const latest = mode === 'all' \? await loadLatestAttempts/);
  assert.match(site, /const retryAttempts = new Map\(\)/);
  assert.match(site, /if \(mode === 'all' && visibleAttempt\?\.answer === option\.id\) input\.checked = true/);
  assert.match(site, /if \(visibleAttempt\) card\.append\(feedback/);
});

test('refazer todas reúne erros de todas as unidades', () => {
  assert.match(site, /function questionScope\(mode, openErrors\)/);
  assert.match(site, /: catalog\.questions;/);
  assert.match(site, /href: pageUrl\('questions', \{ mode: 'errors' \}\)/);
  assert.match(site, /const unit = unitForQuestion\(question\)/);
});

test('cliente Supabase possui wrapper local testável sem segredo elevado', () => {
  assert.match(site, /from '.\/supabase-client\.js'/);
  assert.match(client, /@supabase\/supabase-js@2/);
  assert.doesNotMatch(site + client, /service_role|sb_secret_/i);
});

test('CI executa navegador real em Chromium para computador e celular', () => {
  assert.match(ci, /@playwright\/test@1\.61\.1/);
  assert.match(ci, /playwright install --with-deps chromium/);
  assert.match(ci, /npm run test:e2e/);
  assert.match(config, /Desktop Chrome/);
  assert.match(config, /Pixel 7/);
  assert.match(e2e, /Refazer todas/);
  assert.match(e2e, /Gabarito:/);
  assert.match(e2e, /input\[type="radio"\]:checked/);
});

test('documentação representa o estado atual e código legado foi retirado', async () => {
  assert.match(readme, /11 páginas/);
  assert.match(readme, /Supabase/);
  assert.match(readme, /refação limpa/);
  assert.doesNotMatch(readme, /estrutura técnica vazia|ainda não foi aplicada a um projeto remoto/i);
  await assert.rejects(access(new URL('../assets/app.js', import.meta.url)));
});
