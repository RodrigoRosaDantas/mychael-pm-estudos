import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const app = await readFile(path.join(root, 'assets/app.js'), 'utf8');
const config = await readFile(path.join(root, 'assets/supabase-config.js'), 'utf8');
const requiredFiles = ['assets/styles.css', 'assets/app.js', 'assets/supabase-config.js', 'content/catalog.json', '.nojekyll'];
for (const file of requiredFiles) await access(path.join(root, file));

const requiredSections = ['inicio','acesso','estudo','materias','questoes','revisoes','erros','provas','simulados','taf','desempenho','configuracoes'];
for (const id of requiredSections) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Seção obrigatória ausente: ${id}`);
}
if (/href="#redacao"|>Redação</i.test(html)) throw new Error('Redação não pode aparecer no menu inicial.');
if (!html.includes('STU-MYCHAEL')) throw new Error('ID permanente do perfil ausente.');
if (!html.includes('id="loginForm"') || !html.includes('id="logoutButton"')) throw new Error('Controles de autenticação ausentes.');
if (/signUp\s*\(|Cadastrar|Criar conta/i.test(app + html)) throw new Error('Cadastro público não pode ser oferecido.');
if (!app.includes('signInWithPassword') || !app.includes("from('student_profiles')")) throw new Error('Integração autenticada do perfil ausente.');
if (!config.includes('sb_publishable_')) throw new Error('Configuração deve usar publishable key moderna.');
if (/sb_secret_|service_role/i.test(config + app + html)) throw new Error('Segredo elevado encontrado no conteúdo público.');
console.log('Estrutura estática válida: arquivos, autenticação, menu e restrições do MVP conferidos.');
