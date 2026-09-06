import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const studyCycleRuntime = await readFile(new URL('../assets/study-cycle-runtime.js', import.meta.url), 'utf8');

test('cronograma autenticado insere conteúdo editorial como texto, não como HTML', () => {
  assert.match(studyCycleRuntime, /function renderCycleStatus\(/);
  assert.match(studyCycleRuntime, /target\.replaceChildren\(/);
  assert.match(studyCycleRuntime, /node\('p', '', detail\)/);
  assert.match(studyCycleRuntime, /currentUnit\?\.title \?\? 'Próxima unidade'/);
  assert.doesNotMatch(studyCycleRuntime, /status\.innerHTML\s*=\s*`[^`]*currentUnit/s);
});
