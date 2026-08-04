import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pageFiles = [
  'index.html', 'estudar.html', 'materias.html', 'questoes.html', 'revisoes.html',
  'erros.html', 'provas.html', 'simulados.html', 'taf.html', 'desempenho.html',
  'configuracoes.html'
];
const pages = await Promise.all(pageFiles.map((file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
const [site, styles, workflow] = await Promise.all([
  readFile(new URL('../assets/site.js', import.meta.url), 'utf8'),
  readFile(new URL('../assets/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8')
]);

test('plataforma possui páginas próprias em vez de uma inicial longa', () => {
  assert.equal(pages.length, 11);
  pages.forEach((html, index) => {
    assert.match(html, /id="app"/);
    assert.match(html, /assets\/site\.js/);
    assert.doesNotMatch(html, /id="(estudo|questoes|revisoes|erros|desempenho)"/);
    assert.ok(html.length < 1500, `${pageFiles[index]} deve manter HTML enxuto.`);
  });
});

test('navegação compartilhada aponta para todas as áreas', () => {
  for (const file of pageFiles) assert.ok(site.includes(`'${file}'`), `Navegação sem ${file}.`);
  assert.doesNotMatch(site, /href="#redacao"|>Redação</i);
});

test('visualização de computador usa menu lateral e conteúdo amplo', () => {
  assert.match(styles, /\.app-shell\{min-height:100vh;display:grid;grid-template-columns:270px minmax\(0,1fr\)\}/);
  assert.match(styles, /max-width:var\(--max\)/);
  assert.match(styles, /\.question-layout\{display:grid;grid-template-columns:190px minmax\(0,1fr\)/);
});

test('visualização móvel usa cabeçalho, gaveta e uma coluna', () => {
  assert.match(styles, /@media\(max-width:860px\)/);
  assert.match(styles, /\.mobile-header\{position:sticky/);
  assert.match(styles, /transform:translateX\(-105%\)/);
  assert.match(styles, /\.sidebar\.open\{transform:translateX\(0\)\}/);
  assert.match(styles, /\.question-layout\{grid-template-columns:1fr\}/);
});

test('componentes preservam acessibilidade e movimento reduzido', () => {
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
  assert.match(site, /aria-current/);
  assert.match(site, /aria-live="polite"/);
});

test('workflow publica todos os arquivos html', () => {
  assert.match(workflow, /cp -R \.\/\*\.html assets content \.nojekyll _site\//);
});
