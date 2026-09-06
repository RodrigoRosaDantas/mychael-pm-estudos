import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('carregador compartilhado deduplica o catálogo e permite nova tentativa após falha', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ contentVersion: 62 }) };
  };

  try {
    const url = new URL(`../assets/content-loader.js?test=${Date.now()}`, import.meta.url);
    const loader = await import(url.href);
    await assert.rejects(loader.loadCatalog(), /503/);
    const [first, second] = await Promise.all([loader.loadCatalog(), loader.loadCatalog()]);
    assert.strictEqual(first, second);
    assert.equal(first.contentVersion, 62);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('módulos públicos usam um único ponto de leitura para os JSONs compartilhados', async () => {
  const assetsUrl = new URL('../assets/', import.meta.url);
  const files = (await readdir(assetsUrl)).filter((file) => file.endsWith('.js') && file !== 'content-loader.js');
  const sources = await Promise.all(files.map((file) => readFile(new URL(file, assetsUrl), 'utf8')));
  const directSharedFetch = /fetch\([^\n]*(?:catalog\.json|content-applicability\.json|curriculum-matrix\.json|study-cycle-v1\.json|exams-history\.json|taf-pmmg-historical\.json)/;
  for (let index = 0; index < files.length; index += 1) {
    assert.doesNotMatch(sources[index], directSharedFetch, `${files[index]} voltou a baixar um JSON compartilhado diretamente`);
  }

  const loader = await readFile(new URL('../assets/content-loader.js', import.meta.url), 'utf8');
  assert.match(loader, /cache: 'no-cache'/);
  assert.doesNotMatch(loader, /cache: 'no-store'/);
});
