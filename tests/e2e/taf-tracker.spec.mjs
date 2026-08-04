import { test, expect } from '@playwright/test';

const MOCK_SUPABASE_MODULE = String.raw`
const clone = (value) => JSON.parse(JSON.stringify(value));
const db = {
  student_profiles: [{ id: 'STU-MYCHAEL', status: 'active' }],
  taf_attempts: [{
    id: 'taf-1',
    profile_id: 'STU-MYCHAEL',
    test_id: 'corrida_12_minutos',
    reference_id: null,
    performed_at: '2026-08-04T15:00:00.000Z',
    measured_value: 1800,
    measured_unit: 'metros',
    medical_clearance: true,
    professional_supervision: false,
    notes: 'Treino leve.',
    created_at: '2026-08-04T15:00:00.000Z'
  }]
};
let sequence = 1;
const matches = (row, filters) => filters.every(({ column, value }) => row[column] === value);

class Query {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.filters = [];
    this.payload = null;
    this.ordering = null;
    this.limitValue = null;
  }
  select() { return this; }
  eq(column, value) { this.filters.push({ column, value }); return this; }
  order(column, options = {}) { this.ordering = { column, ascending: options.ascending !== false }; return this; }
  limit(value) { this.limitValue = value; return this; }
  insert(payload) { this.action = 'insert'; this.payload = payload; return this; }
  async maybeSingle() {
    const result = await this.execute();
    return { ...result, data: result.data?.[0] ?? null };
  }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    const rows = db[this.table] ?? [];
    if (this.action === 'insert') {
      rows.push({ ...clone(this.payload), id: 'taf-' + (++sequence), created_at: new Date().toISOString() });
      return { data: null, error: null };
    }
    let selected = rows.filter((row) => matches(row, this.filters));
    if (this.ordering) selected = [...selected].sort((a, b) => {
      const result = String(a[this.ordering.column] ?? '').localeCompare(String(b[this.ordering.column] ?? ''));
      return this.ordering.ascending ? result : -result;
    });
    if (this.limitValue != null) selected = selected.slice(0, this.limitValue);
    return { data: clone(selected), error: null };
  }
}

export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'auth-user' } } }, error: null }),
      signInWithPassword: async () => ({ data: { session: { user: { id: 'auth-user' } } }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    },
    from: (table) => new Query(table)
  };
}
`;

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/supabase-client.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: MOCK_SUPABASE_MODULE });
  });
});

test('TAF registra treino privado e atualiza o histórico', async ({ page }) => {
  await page.goto('/taf.html');

  await expect(page.getByRole('heading', { name: 'Acompanhamento de treino' })).toBeVisible();
  await expect(page.getByText('1.800 metros', { exact: true })).toBeVisible();
  await expect(page.getByText('A plataforma não publica índice oficial vigente nesta etapa.', { exact: false })).toBeVisible();

  await page.getByLabel('Tipo de teste ou exercício').selectOption('abdominal');
  await page.getByLabel('Resultado medido').fill('25');
  await page.getByLabel('Unidade de medida').selectOption('repetições');
  await page.getByLabel('O treino teve supervisão profissional').check();
  await page.getByLabel('Observações opcionais').fill('Execução controlada.');
  await page.getByRole('button', { name: 'Salvar treino' }).click();

  await expect(page.getByText('Treino registrado no Supabase privado.', { exact: true })).toBeVisible();
  await expect(page.getByText('25 repetições', { exact: true })).toBeVisible();
  await expect(page.locator('.taf-history-item')).toHaveCount(2);
});

test('TAF mantém formulário utilizável no celular', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  await page.goto('/taf.html');
  await expect(page.getByLabel('Tipo de teste ou exercício')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar treino' })).toBeVisible();
});
