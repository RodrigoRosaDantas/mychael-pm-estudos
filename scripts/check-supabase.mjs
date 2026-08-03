import { readFile } from 'node:fs/promises';
import { validateSupabaseMigration } from './supabase-rules.mjs';

const migrationUrl = new URL('../supabase/migrations/20260803033000_create_progress_schema.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');
const errors = validateSupabaseMigration(sql);

if (errors.length > 0) {
  console.error('Falha na validação da migração Supabase:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('Migração Supabase validada estaticamente.');
}
