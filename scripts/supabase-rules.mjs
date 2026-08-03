const REQUIRED_TABLES = [
  'student_profiles',
  'study_units',
  'study_sessions',
  'question_attempts',
  'error_items',
  'review_items',
  'exam_attempts',
  'simulation_attempts',
  'taf_attempts',
  'devices',
  'student_settings'
];

const FORBIDDEN_PATTERNS = [
  /sb_secret_[a-z0-9_-]+/i,
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,
  /SUPABASE_SERVICE_ROLE_KEY\s*=/i,
  /SUPABASE_SECRET_KEY\s*=/i
];

export function validateSupabaseMigration(sql) {
  const errors = [];

  for (const table of REQUIRED_TABLES) {
    const createPattern = new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, 'i');
    if (!createPattern.test(sql)) {
      errors.push(`Tabela obrigatória ausente: ${table}`);
    }

    const rlsPattern = new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i');
    if (!rlsPattern.test(sql)) {
      errors.push(`RLS não habilitada: ${table}`);
    }
  }

  if (!/create\s+schema\s+if\s+not\s+exists\s+private/i.test(sql)) {
    errors.push('Schema privado de autorização ausente.');
  }

  if (!/create\s+or\s+replace\s+function\s+private\.owns_student_profile/i.test(sql)) {
    errors.push('Helper privado de isolamento do perfil ausente.');
  }

  if (!/private\.owns_student_profile[\s\S]*security\s+invoker/i.test(sql)) {
    errors.push('O helper privado deve usar SECURITY INVOKER.');
  }

  if (!/drop\s+function\s+if\s+exists\s+public\.owns_student_profile\s*\(text\)/i.test(sql)) {
    errors.push('O helper SECURITY DEFINER do schema público não foi removido.');
  }

  if (!/auth\.uid\(\)\)\s+is\s+not\s+null|auth\.uid\(\)\s+is\s+not\s+null/i.test(sql)) {
    errors.push('A verificação explícita de usuário autenticado está ausente.');
  }

  if (!/to\s+authenticated/i.test(sql)) {
    errors.push('As políticas não estão restritas ao papel authenticated.');
  }

  if (/to\s+anon/i.test(sql)) {
    errors.push('O progresso pessoal não pode conceder políticas ao papel anon.');
  }

  if (!/alter\s+default\s+privileges[\s\S]*revoke\s+execute\s+on\s+functions/i.test(sql)) {
    errors.push('Privilégios padrão de funções públicas não foram endurecidos.');
  }

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(sql)) {
      errors.push(`Possível segredo encontrado: ${pattern}`);
    }
  }

  return errors;
}

export { REQUIRED_TABLES };
