import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSupabaseMigration } from '../scripts/supabase-rules.mjs';

const migrationUrl = new URL('../supabase/migrations/20260803033000_create_progress_schema.sql', import.meta.url);

test('migração real possui tabelas e RLS obrigatórias', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.deepEqual(validateSupabaseMigration(sql), []);
});

test('detecta tabela sem RLS', () => {
  const sql = `
    create table if not exists public.student_profiles (id text);
    create or replace function public.owns_student_profile(target_profile_id text)
    returns boolean language sql as $$ select auth.uid() is not null $$;
    create policy sample on public.student_profiles to authenticated using (true);
  `;
  assert.ok(validateSupabaseMigration(sql).some((error) => error.includes('RLS não habilitada')));
});

test('detecta segredo elevado exposto', () => {
  const sql = `SUPABASE_SECRET_KEY=sb_secret_exemplo_nao_real`;
  assert.ok(validateSupabaseMigration(sql).some((error) => error.includes('Possível segredo')));
});

test('bloqueia política para usuário não autenticado', () => {
  const sql = `create policy unsafe on public.anything to anon using (true);`;
  assert.ok(validateSupabaseMigration(sql).some((error) => error.includes('papel anon')));
});
