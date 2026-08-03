import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const app = await readFile(path.join(root, 'assets/app.js'), 'utf8');
const config = await readFile(path.join(root, 'assets/supabase-config.js'), 'utf8');
const catalog = JSON.parse(await readFile(path.join(root, 'content/catalog.json'), 'utf8'));
const requiredFiles = ['assets/styles.css', 'assets/app.js', 'assets/supabase-config.js', 'content/catalog.json', '.nojekyll'];
for (const file of requiredFiles) await access(path.join(root, file));
const requiredSections = ['inicio','acesso','estudo','materias','questoes','revisoes','erros','provas','simulados','taf','desempenho','configuracoes'];
for (const id of requiredSections) {
if (!html.includes(`id="${id}"`)) throw new Error(`Seção obrigatória ausente: ${id}`);
}
for (const id of ['publicationBadge','heroDescription','unitWorkspace','questionWorkspace','studyProgress']) {
if (!html.includes(`id="${id}"`)) throw new Error(`Controle da primeira unidade ausente: ${id}`);
}
if (/href="#redacao"|>Redação</i.test(html)) throw new Error('Redação não pode aparecer no menu inicial.');
if (!html.includes('STU-MYCHAEL')) throw new Error('ID permanente do perfil ausente.');
if (!html.includes('id="loginForm"') || !html.includes('id="logoutButton"')) throw new Error('Controles de autenticação ausentes.');
if (/signUp\s*\(|Cadastrar|Criar conta/i.test(app + html)) throw new Error('Cadastro público não pode ser oferecido.');
if (!app.includes('signInWithPassword') || !app.includes("from('student_profiles')")) throw new Error('Integração autenticada do perfil ausente.');
if (!app.includes("from('question_attempts')") || !app.includes("from('study_units')")) throw new Error('Persistência de tentativas e unidade ausente.');
if (!app.includes("from('error_items')")) throw new Error('Integração do caderno de erros ausente.');
if (!config.includes('sb_publishable_')) throw new Error('Configuração deve usar publishable key moderna.');
if (/sb_secret_|service_role/i.test(config + app + html)) throw new Error('Segredo elevado encontrado no conteúdo público.');
if (catalog.contentVersion < 1 || catalog.units.length < 1 || catalog.questions.length < 1) {
throw new Error('Primeira unidade autorizada não está presente no catálogo.');
}
console.log('Estrutura estática válida: autenticação, primeira unidade, tentativas, menu e restrições do MVP conferidos.');
