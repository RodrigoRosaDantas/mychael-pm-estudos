import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { validateSupabaseMigration } from '../scripts/supabase-rules.mjs';

async function readMigrationChain() {
  const migrationsUrl = new URL('../supabase/migrations/', import.meta.url);
  const filenames = (await readdir(migrationsUrl))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const parts = await Promise.all(
    filenames.map((name) => readFile(new URL(name, migrationsUrl), 'utf8'))
  );
  return parts.join('\n\n');
}

test('cadeia real possui tabelas, RLS e isolamento obrigatórios', async () => {
  const sql = await readMigrationChain();
  assert.deepEqual(validateSupabaseMigration(sql), []);
});

test('detecta tabela sem RLS', () => {
  const sql = `
    create table if not exists public.student_profiles (id text);
    create policy sample on public.student_profiles to authenticated using (true);
  `;
  assert.ok(validateSupabaseMigration(sql).some((error) => error.includes('RLS não habilitada')));
});

test('exige helper privado com security invoker', () => {
  const sql = `
    create or replace function public.owns_student_profile(target_profile_id text)
    returns boolean language sql security definer
    as $$ select auth.uid() is not null $$;
  `;
  const errors = validateSupabaseMigration(sql);
  assert.ok(errors.some((error) => error.includes('Helper privado')));
  assert.ok(errors.some((error) => error.includes('SECURITY INVOKER')));
  assert.ok(errors.some((error) => error.includes('não foi removido')));
});

test('detecta segredo elevado exposto', () => {
  const sql = `SUPABASE_SECRET_KEY=sb_secret_exemplo_nao_real`;
  assert.ok(validateSupabaseMigration(sql).some((error) => error.includes('Possível segredo')));
});

test('bloqueia política para usuário não autenticado', () => {
  const sql = `create policy unsafe on public.anything to anon using (true);`;
  assert.ok(validateSupabaseMigration(sql).some((error) => error.includes('papel anon')));
});
