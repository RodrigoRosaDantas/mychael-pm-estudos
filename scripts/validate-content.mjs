import { readFile } from 'node:fs/promises';
import { validateCatalog } from './content-rules.mjs';

const catalog = JSON.parse(await readFile(new URL('../content/catalog.json', import.meta.url), 'utf8'));
const errors = validateCatalog(catalog);
if (errors.length) {
  console.error('Validação falhou:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('Catálogo válido: nenhum conteúdo indevido ou relação mínima inválida foi detectada.');
