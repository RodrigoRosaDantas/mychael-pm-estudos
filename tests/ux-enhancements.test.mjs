import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, js, css, workflow] = await Promise.all([
  readFile(new URL('../cronograma.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/enhancements.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/enhancements.css', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')
]);

test('cronograma é orientado por ciclos e preserva foco no iniciante', () => {
  assert.match(html, /data-page="schedule"/);
  assert.match(js, /Primeiro o que é comum\. Específicas só depois da calibração\./);
  assert.match(js, /Rotação específica ainda desativada/);
  assert.match(js, /PMDF → PMGO → PMMG/);
  assert.match(js, /O ciclo acompanha o aprendizado, não o calendário/);
});

test('experiência oferece temas de leitura e navegação móvel', () => {
  assert.match(js, /'light', 'dark', 'comfort'/);
  assert.match(js, /Leitura confortável/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /html\[data-theme="comfort"\]/);
  assert.match(css, /\.mobile-bottom-nav/);
});

test('camada progressiva observa somente a raiz de conteúdo', () => {
  assert.match(js, /document\.querySelector\('#pageContent'\)/);
  assert.match(js, /observer\.observe\(content, \{ childList: true \}\)/);
  assert.doesNotMatch(js, /observer\.observe\(document\.documentElement, \{ childList: true, subtree: true \}\)/);
});

test('questões por matéria preservam sequência pedagógica', () => {
  assert.match(js, /Escolha a matéria que quer treinar/);
  assert.match(js, /sem pular a sequência pedagógica/);
  assert.match(js, /questoes\.html\?subject=/);
});

test('deploy publica metadados reais de sincronização', () => {
  assert.match(workflow, /Generate deployment metadata/);
  assert.match(workflow, /content\/deployment\.json/);
  assert.match(js, /Última sincronização/);
});
