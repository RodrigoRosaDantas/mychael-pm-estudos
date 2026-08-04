import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = Object.freeze({
  'index.html': 'home',
  'estudar.html': 'study',
  'materias.html': 'subjects',
  'questoes.html': 'questions',
  'revisoes.html': 'reviews',
  'erros.html': 'errors',
  'provas.html': 'exams',
  'simulados.html': 'simulations',
  'taf.html': 'taf',
  'desempenho.html': 'performance',
  'configuracoes.html': 'settings'
});
const requiredFiles = [
  ...Object.keys(pages),
  'assets/styles.css',
  'assets/site.js',
  'assets/supabase-client.js',
  'assets/supabase-config.js',
  'content/catalog.json',
  'content/manifest.json',
  '.nojekyll'
];
for (const file of requiredFiles) await access(path.join(root, file));

const htmlEntries = await Promise.all(Object.entries(pages).map(async ([file, page]) => [
  file,
  page,
  await readFile(path.join(root, file), 'utf8')
]));
const site = await readFile(path.join(root, 'assets/site.js'), 'utf8');
const client = await readFile(path.join(root, 'assets/supabase-client.js'), 'utf8');
const styles = await readFile(path.join(root, 'assets/styles.css'), 'utf8');
const config = await readFile(path.join(root, 'assets/supabase-config.js'), 'utf8');
const catalog = JSON.parse(await readFile(path.join(root, 'content/catalog.json'), 'utf8'));

for (const [file, page, html] of htmlEntries) {
  if (!html.includes(`data-page="${page}"`)) throw new Error(`${file}: identificação da página ausente.`);
  if (!html.includes('./assets/site.js')) throw new Error(`${file}: módulo compartilhado ausente.`);
  if (!html.includes('./assets/styles.css')) throw new Error(`${file}: estilos compartilhados ausentes.`);
  if (/href="#(estudo|materias|questoes|revisoes|erros|desempenho)"/.test(html)) {
    throw new Error(`${file}: navegação interna longa encontrada; use páginas próprias.`);
  }
}

for (const href of Object.keys(pages)) {
  if (!site.includes(`'${href}'`)) throw new Error(`Navegação sem a página ${href}.`);
}
for (const integration of [
  "from('student_profiles')",
  "from('question_attempts')",
  "from('study_units')",
  "from('error_items')",
  "from('review_items')"
]) {
  if (!site.includes(integration)) throw new Error(`Integração privada ausente: ${integration}.`);
}
for (const behavior of [
  'loadOpenErrorQuestionIds',
  'registerError',
  'resolveError',
  'questionScope',
  'retryAttempts',
  'Refazer todas',
  "mode: 'errors'"
]) {
  if (!site.includes(behavior)) throw new Error(`Fluxo do caderno de erros incompleto: ${behavior}.`);
}
if (!site.includes("import { createClient } from './supabase-client.js'")) {
  throw new Error('Cliente Supabase não está isolado para validação segura no navegador.');
}
if (!client.includes("@supabase/supabase-js@2")) throw new Error('Wrapper do cliente Supabase inválido.');
if (!site.includes('signInWithPassword') || /signUp\s*\(|Cadastrar|Criar conta/i.test(site)) {
  throw new Error('A autenticação deve permitir somente entrada, sem cadastro público.');
}
if (!config.includes('sb_publishable_')) throw new Error('Configuração deve usar publishable key moderna.');
if (/sb_secret_|service_role/i.test(config + site + client + htmlEntries.map(([, , html]) => html).join('\n'))) {
  throw new Error('Segredo elevado encontrado no conteúdo público.');
}
if (!styles.includes('@media(max-width:860px)') || !styles.includes('.app-shell{min-height:100vh;display:grid')) {
  throw new Error('Layout responsivo para computador e celular incompleto.');
}
if (catalog.contentVersion < 1 || catalog.units.length < 1 || catalog.questions.length < 1) {
  throw new Error('Primeira unidade autorizada não está presente no catálogo.');
}
if (catalog.features?.essay !== false || catalog.features?.taf !== true) {
  throw new Error('Restrições do MVP divergentes.');
}
console.log(`Estrutura estática válida: ${Object.keys(pages).length} páginas, navegação responsiva e refação limpa conferidas.`);
