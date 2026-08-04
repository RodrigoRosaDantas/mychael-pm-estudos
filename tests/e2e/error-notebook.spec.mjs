import { test, expect } from '@playwright/test';

const MOCK_SUPABASE_MODULE = String.raw`
const clone = (value) => JSON.parse(JSON.stringify(value));
const db = {
  student_profiles: [{ id: 'STU-MYCHAEL', status: 'active' }],
  study_units: [
    { id: 'su-1', profile_id: 'STU-MYCHAEL', unit_id: 'U001', status: 'completed', mastery_percent: 80 },
    { id: 'su-2', profile_id: 'STU-MYCHAEL', unit_id: 'U002', status: 'completed', mastery_percent: 0 }
  ],
  question_attempts: [
    { id: 'att-1', profile_id: 'STU-MYCHAEL', question_id: 'Q000005', unit_id: 'U001', answer: 'A', is_correct: false, attempt_number: 1, answered_at: '2026-08-04T10:00:00.000Z' },
    { id: 'att-2', profile_id: 'STU-MYCHAEL', question_id: 'Q000006', unit_id: 'U002', answer: 'B', is_correct: false, attempt_number: 1, answered_at: '2026-08-04T10:01:00.000Z' }
  ],
  error_items: [
    { id: 'err-1', profile_id: 'STU-MYCHAEL', question_id: 'Q000005', attempt_id: 'att-1', error_type: 'interpretation', status: 'open', created_at: '2026-08-04T10:00:00.000Z' },
    { id: 'err-2', profile_id: 'STU-MYCHAEL', question_id: 'Q000006', attempt_id: 'att-2', error_type: 'interpretation', status: 'open', created_at: '2026-08-04T10:01:00.000Z' }
  ],
  review_items: [
    { id: 'rev-1', profile_id: 'STU-MYCHAEL', source_type: 'question', source_id: 'Q000005', status: 'scheduled', repetitions: 0, next_review_at: '2026-08-05T10:00:00.000Z' },
    { id: 'rev-2', profile_id: 'STU-MYCHAEL', source_type: 'question', source_id: 'Q000006', status: 'scheduled', repetitions: 0, next_review_at: '2026-08-05T10:01:00.000Z' }
  ]
};
let sequence = 10;
const matches = (row, filters) => filters.every((filter) => filter.type === 'eq'
  ? row[filter.column] === filter.value
  : filter.values.includes(row[filter.column]));

class Query {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.filters = [];
    this.returning = false;
    this.head = false;
    this.limitValue = null;
    this.ordering = null;
    this.payload = null;
  }
  select(_columns, options = {}) {
    if (['insert', 'update', 'upsert'].includes(this.action)) this.returning = true;
    else this.action = 'select';
    this.head = Boolean(options.head);
    return this;
  }
  eq(column, value) { this.filters.push({ type: 'eq', column, value }); return this; }
  in(column, values) { this.filters.push({ type: 'in', column, values }); return this; }
  order(column, options = {}) { this.ordering = { column, ascending: options.ascending !== false }; return this; }
  limit(value) { this.limitValue = value; return this; }
  insert(payload) { this.action = 'insert'; this.payload = payload; return this; }
  update(payload) { this.action = 'update'; this.payload = payload; return this; }
  upsert(payload) { this.action = 'upsert'; this.payload = payload; return this; }
  async maybeSingle() {
    const result = await this.execute();
    return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
  }
  async single() {
    const result = await this.execute();
    return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
  }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    const rows = db[this.table] ?? [];
    if (this.action === 'select') {
      let selected = rows.filter((row) => matches(row, this.filters));
      if (this.ordering) selected = [...selected].sort((a, b) => {
        const result = String(a[this.ordering.column] ?? '').localeCompare(String(b[this.ordering.column] ?? ''));
        return this.ordering.ascending ? result : -result;
      });
      if (this.limitValue != null) selected = selected.slice(0, this.limitValue);
      return { data: this.head ? null : clone(selected), error: null, count: this.head ? selected.length : null };
    }
    if (this.action === 'insert') {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((item) => ({
        ...clone(item),
        id: item.id ?? this.table.slice(0, 3) + '-' + (++sequence),
        answered_at: item.answered_at ?? new Date().toISOString(),
        created_at: item.created_at ?? new Date().toISOString()
      }));
      rows.push(...items);
      return { data: this.returning ? clone(items) : null, error: null, count: null };
    }
    if (this.action === 'update') {
      const changed = [];
      for (const row of rows.filter((item) => matches(item, this.filters))) {
        Object.assign(row, clone(this.payload));
        changed.push(row);
      }
      return { data: this.returning ? clone(changed) : null, error: null, count: null };
    }
    if (this.action === 'upsert') {
      const item = clone(this.payload);
      const existing = rows.find((row) => row.profile_id === item.profile_id && row.source_type === item.source_type && row.source_id === item.source_id);
      if (existing) Object.assign(existing, item);
      else rows.push({ ...item, id: this.table.slice(0, 3) + '-' + (++sequence) });
      return { data: null, error: null, count: null };
    }
    return { data: null, error: null, count: null };
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

async function prepare(page) {
  await page.route('**/assets/supabase-client.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: MOCK_SUPABASE_MODULE });
  });
  await page.route('**/content/catalog.json', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    const baseQuestion = data.questions.find(({ id }) => id === 'Q000005');
    const baseUnit = data.units.find(({ id }) => id === 'U001');
    data.questions.push({
      ...baseQuestion,
      id: 'Q000006',
      unitId: 'U002',
      title: 'Questão de outra unidade',
      statement: 'Questão simulada de uma segunda unidade para validar o caderno global.',
      answer: 'A'
    });
    data.units.push({
      ...baseUnit,
      id: 'U002',
      order: 20,
      title: 'Português — Segunda unidade de teste',
      questionIds: ['Q000006'],
      materialIds: []
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(data)
    });
  });
}

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('caderno reúne erros de várias unidades e inicia refação sem revelar resposta', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  await page.goto('/erros.html');
  await expect(page.getByRole('heading', { name: '2 questão(ões) para refazer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Refazer esta questão' })).toHaveCount(2);

  const allErrors = page.getByRole('link', { name: 'Refazer todas' });
  await expect(allErrors).toHaveAttribute('href', /questoes\.html\?mode=errors$/);
  await allErrors.click();

  await expect(page).toHaveURL(/questoes\.html\?mode=errors$/);
  await expect(page.locator('.palette-button')).toHaveCount(2);
  await expect(page.locator('.feedback')).toHaveCount(0);
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
  await expect(page.getByText('Gabarito:', { exact: false })).toHaveCount(0);

  await page.locator('.option-row input[value="A"]').check();
  await page.getByRole('button', { name: 'Refazer questão' }).click();
  await expect(page.getByText('Resposta incorreta.', { exact: false })).toBeVisible();
  await expect(page.getByText('Nova tentativa salva; a questão permanece no caderno.')).toBeVisible();

  await page.locator('.palette-button').nth(1).click();
  await expect(page.getByText('Português — Segunda unidade de teste', { exact: true })).toBeVisible();
  await expect(page.locator('.feedback')).toHaveCount(0);
  await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
});

test('layout mantém navegação adequada no computador e no celular', async ({ page }, testInfo) => {
  await page.goto('/index.html');
  const sidebar = page.locator('#sidebar');
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
    await expect(sidebar).not.toHaveClass(/open/);
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(sidebar).toHaveClass(/open/);
    await expect(page.locator('body')).toHaveClass(/menu-open/);
  } else {
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
  }
});
