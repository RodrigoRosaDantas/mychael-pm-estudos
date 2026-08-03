import { readdir, readFile } from 'node:fs/promises';
import { validateSupabaseMigration } from './supabase-rules.mjs';

const migrationsUrl = new URL('../supabase/migrations/', import.meta.url);
const filenames = (await readdir(migrationsUrl))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const sqlParts = await Promise.all(
  filenames.map((name) => readFile(new URL(name, migrationsUrl), 'utf8'))
);

const sql = sqlParts.join('\n\n');
const errors = validateSupabaseMigration(sql);

if (errors.length > 0) {
  console.error('Falha na validação das migrações Supabase:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`${filenames.length} migrações Supabase validadas estaticamente.`);
}
