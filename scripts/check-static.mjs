import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = Object.freeze({
  'index.html': 'home',
  'estudar.html': 'study',
  'materias.html': 'subjects',
  'cronograma.html': 'schedule',
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
  'assets/enhancements.js',
  'assets/enhancements.css',
  'assets/curriculum-matrix.js',
  'assets/curriculum-matrix.css',
  'assets/applicability-core.js',
  'assets/competition-progress.js',
  'assets/competition-progress.css',
  'assets/supabase-client.js',
  'assets/supabase-config.js',
  'content/catalog.json',
  'content/manifest.json',
  'content/curriculum-matrix.json',
  'content/content-applicability.json',
  '.nojekyll'
];
for (const file of requiredFiles) await access(path.join(root, file));

const htmlEntries = await Promise.all(Object.entries(pages).map(async ([file, page]) => [
  file,
  page,
  await readFile(path.join(root, file), 'utf8')
]));
const site = await readFile(path.join(root, 'assets/site.js'), 'utf8');
const enhancements = await readFile(path.join(root, 'assets/enhancements.js'), 'utf8');
const curriculumMatrix = await readFile(path.join(root, 'assets/curriculum-matrix.js'), 'utf8');
const competitionProgress = await readFile(path.join(root, 'assets/competition-progress.js'), 'utf8');
const applicabilityCore = await readFile(path.join(root, 'assets/applicability-core.js'), 'utf8');
const client = await readFile(path.join(root, 'assets/supabase-client.js'), 'utf8');
const styles = await readFile(path.join(root, 'assets/styles.css'), 'utf8');
const enhancementStyles = await readFile(path.join(root, 'assets/enhancements.css'), 'utf8');
const config = await readFile(path.join(root, 'assets/supabase-config.js'), 'utf8');
const catalog = JSON.parse(await readFile(path.join(root, 'content/catalog.json'), 'utf8'));
const applicability = JSON.parse(await readFile(path.join(root, 'content/content-applicability.json'), 'utf8'));

for (const [file, page, html] of htmlEntries) {
  if (!html.includes(`data-page="${page}"`)) throw new Error(`${file}: identificação da página ausente.`);
  if (!html.includes('./assets/site.js')) throw new Error(`${file}: módulo compartilhado ausente.`);
  if (!html.includes('./assets/enhancements.js')) throw new Error(`${file}: camada progressiva de experiência ausente.`);
  if (!html.includes('./assets/styles.css')) throw new Error(`${file}: estilos compartilhados ausentes.`);
  if (/href="#(estudo|materias|questoes|revisoes|erros|desempenho)"/.test(html)) {
    throw new Error(`${file}: navegação interna longa encontrada; use páginas próprias.`);
  }
}

for (const file of ['estudar.html', 'materias.html', 'cronograma.html', 'desempenho.html']) {
  const html = htmlEntries.find(([name]) => name === file)?.[2] ?? '';
  if (!html.includes('./assets/competition-progress.js')) throw new Error(`${file}: camada multi-concurso ausente.`);
}
const scheduleHtml = htmlEntries.find(([name]) => name === 'cronograma.html')?.[2] ?? '';
if (!scheduleHtml.includes('./assets/curriculum-matrix.js')) throw new Error('cronograma.html: matriz curricular ausente.');

const navigationSource = `${site}\n${enhancements}`;
for (const href of Object.keys(pages)) {
  if (!navigationSource.includes(`'${href}'`) && !navigationSource.includes(`"${href}"`)) {
    throw new Error(`Navegação sem a página ${href}.`);
  }
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
for (const uxBehavior of [
  'Cronograma por ciclos',
  'PMDF → PMGO → PMMG',
  'Escolha a matéria que quer treinar',
  'Leitura confortável',
  'Última sincronização',
  'Estude com método. Avance com constância.'
]) {
  if (!enhancements.includes(uxBehavior)) throw new Error(`Melhoria de experiência ausente: ${uxBehavior}.`);
}
for (const monitoringBehavior of [
  'content/content-applicability.json',
  'Progresso no acervo por foco',
  'Núcleo comum aos três'
]) {
  if (!competitionProgress.includes(monitoringBehavior) && !applicabilityCore.includes(monitoringBehavior)) {
    throw new Error(`Experiência multi-concurso ausente: ${monitoringBehavior}.`);
  }
}
if (!curriculumMatrix.includes('content/curriculum-matrix.json')) throw new Error('Matriz curricular não carrega sua fonte pública.');
if (!Array.isArray(applicability.unitApplicability)) throw new Error('Aplicabilidade por unidade inválida.');
if (!site.includes("import { createClient } from './supabase-client.js'")) {
  throw new Error('Cliente Supabase não está isolado para validação segura no navegador.');
}
if (!client.includes("@supabase/supabase-js@2")) throw new Error('Wrapper do cliente Supabase inválido.');
if (!site.includes('signInWithPassword') || /signUp\s*\(|Cadastrar|Criar conta/i.test(site)) {
  throw new Error('A autenticação deve permitir somente entrada, sem cadastro público.');
}
if (!config.includes('sb_publishable_')) throw new Error('Configuração deve usar publishable key moderna.');
if (/sb_secret_|service_role/i.test(config + site + enhancements + curriculumMatrix + competitionProgress + applicabilityCore + client + htmlEntries.map(([, , html]) => html).join('\n'))) {
  throw new Error('Segredo elevado encontrado no conteúdo público.');
}
if (!styles.includes('@media(max-width:860px)') || !styles.includes('.app-shell{min-height:100vh;display:grid')) {
  throw new Error('Layout responsivo para computador e celular incompleto.');
}
for (const token of ['html[data-theme="dark"]', 'html[data-theme="comfort"]', '.mobile-bottom-nav', '.reader-toolbar']) {
  if (!enhancementStyles.includes(token)) throw new Error(`Estilo progressivo ausente: ${token}.`);
}
if (catalog.contentVersion < 1 || catalog.units.length < 1 || catalog.questions.length < 1) {
  throw new Error('Primeira unidade autorizada não está presente no catálogo.');
}
if (catalog.features?.essay !== false || catalog.features?.taf !== true) {
  throw new Error('Restrições do MVP divergentes.');
}
console.log(`Estrutura estática válida: ${Object.keys(pages).length} páginas, navegação guiada, leitura confortável, multi-concurso e refação limpa conferidas.`);
