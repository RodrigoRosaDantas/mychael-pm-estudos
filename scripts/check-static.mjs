import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const requiredFiles = ['assets/styles.css', 'assets/app.js', 'content/catalog.json', '.nojekyll'];
for (const file of requiredFiles) await access(path.join(root, file));

const requiredSections = ['inicio','estudo','materias','questoes','revisoes','erros','provas','simulados','taf','desempenho','configuracoes'];
for (const id of requiredSections) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Seção obrigatória ausente: ${id}`);
}
if (/href="#redacao"|>Redação</i.test(html)) throw new Error('Redação não pode aparecer no menu inicial.');
if (!html.includes('STU-MYCHAEL')) throw new Error('ID permanente do perfil ausente.');
console.log('Estrutura estática válida: arquivos, menu e restrições do MVP conferidos.');
