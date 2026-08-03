import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, styles] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/styles.css', import.meta.url), 'utf8')
]);

test('layout preserva todas as áreas funcionais', () => {
  for (const id of [
    'inicio', 'acesso', 'estudo', 'unitWorkspace', 'materias', 'questoes',
    'revisoes', 'erros', 'provas', 'simulados', 'taf', 'desempenho', 'configuracoes'
  ]) assert.match(html, new RegExp(`id="${id}"`));
});

test('desktop organiza conteúdo em painel principal e acompanhamento', () => {
  assert.match(styles, /main\{display:grid;grid-template-columns:/);
  assert.match(styles, /#inicio,#acesso,#unitWorkspace,\.grid,#questoes\{grid-column:1\/-1\}/);
  assert.match(styles, /#revisoes,#erros,#simulados,#desempenho,#configuracoes\{grid-column:2\}/);
});

test('navegação recebe hierarquia e indicadores visuais', () => {
  assert.match(styles, /\.sidebar::before\{content:"Navegação"/);
  assert.match(styles, /\.sidebar a:nth-of-type\(11\)::before\{content:"⚙"\}/);
  assert.match(styles, /\.sidebar a\.active::before/);
});

test('celular usa menu lateral e conteúdo em uma coluna', () => {
  assert.match(styles, /@media\(max-width:820px\)/);
  assert.match(styles, /transform:translateX\(-108%\)/);
  assert.match(styles, /\.sidebar\.open\{transform:translateX\(0\)\}/);
  assert.match(styles, /main\{display:block;padding:1rem\}/);
});

test('componentes de estudo mantêm foco, contraste e movimento reduzido', () => {
  for (const selector of ['.hero', '.auth-card', '.question-card', '.option-row:has(input:checked)', '.progress-fill']) {
    assert.ok(styles.includes(selector), `Seletor visual ausente: ${selector}`);
  }
  assert.match(styles, /focus-visible/);
  assert.match(styles, /prefers-reduced-motion:reduce/);
});

test('melhoria não adiciona serviços ou fontes externas', () => {
  assert.doesNotMatch(styles, /fonts\.googleapis|use\.typekit|unpkg\.com/i);
  assert.doesNotMatch(html, /href="#redacao"|>Redação</i);
});
