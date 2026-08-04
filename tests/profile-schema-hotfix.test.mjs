import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const sourceUrl = new URL('../assets/supabase-client.js', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');

test('cliente público usa o campo real is_active e mantém compatibilidade com a interface', () => {
  assert.match(source, /columns === 'id, status' \? 'id, is_active' : columns/);
  assert.match(source, /status: result\.data\.is_active === true \? 'active' : 'inactive'/);
  assert.doesNotMatch(source, /service_role|sb_secret_/i);
});

test('falha na validação privada não derruba o conteúdo público', () => {
  assert.match(source, /if \(result\?\.error\)/);
  assert.match(source, /return \{ data: null, error: null \}/);
});

test('módulo de compatibilidade possui sintaxe JavaScript válida', () => {
  const result = spawnSync(process.execPath, ['--check', sourceUrl.pathname], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
