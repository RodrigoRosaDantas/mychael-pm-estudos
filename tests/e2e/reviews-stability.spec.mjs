import { test, expect } from '@playwright/test';

const MOCK_SUPABASE_MODULE = String.raw`
const clone = (value) => JSON.parse(JSON.stringify(value));
globalThis.__reviewQueryExecutions = 0;
let session = window.__startSignedOut ? null : { user: { id: 'auth-user' } };
const listeners = [];
let holdNextRead = false;
let releaseRead;
let pendingRead = false;
const db = {
  student_profiles: [{ id: 'STU-MYCHAEL', status: 'active', is_active: true }],
  study_units: [{ id: 'su-1', profile_id: 'STU-MYCHAEL', unit_id: 'U001', status: 'in_progress', mastery_percent: 80, completed_at: null }],
  error_items: [{ id: 'err-1', profile_id: 'STU-MYCHAEL', question_id: 'Q000005', status: 'open' }],
  review_items: [{
    id: 'rev-1', profile_id: 'STU-MYCHAEL', source_type: 'question', source_id: 'Q000005',
    reason: 'wrong_answer', status: 'scheduled', repetitions: 0, interval_days: 1,
    next_review_at: '2026-08-09T10:00:00.000Z'
  }]
};

const matches = (row, filters) => filters.every((filter) => filter.type === 'eq'
  ? row[filter.column] === filter.value
  : filter.values.includes(row[filter.column]));

class Query {
  constructor(table) {
    this.table = table;
    this.action = 'select';
    this.filters = [];
    this.ordering = null;
  }
  select(columns) { this.columns = columns; this.action = 'select'; return this; }
  eq(column, value) { this.filters.push({ type: 'eq', column, value }); return this; }
  in(column, values) { this.filters.push({ type: 'in', column, values }); return this; }
  order(column, options = {}) { this.ordering = { column, ascending: options.ascending !== false }; return this; }
  upsert() { this.action = 'upsert'; return this; }
  async maybeSingle() {
    const result = await this.execute();
    return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
  }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    if (this.table === 'review_items' && this.action === 'select') globalThis.__reviewQueryExecutions += 1;
    if (this.action === 'upsert') return { data: null, error: null, count: null };
    let selected = session ? (db[this.table] ?? []).filter((row) => matches(row, this.filters)) : [];
    if (this.ordering) selected = [...selected].sort((a, b) => {
      const result = String(a[this.ordering.column] ?? '').localeCompare(String(b[this.ordering.column] ?? ''));
      return this.ordering.ascending ? result : -result;
    });
    const data = clone(selected);
    if (holdNextRead && this.table === 'review_items' && this.columns?.includes('interval_days')) {
      holdNextRead = false;
      pendingRead = true;
      await new Promise((resolve) => { releaseRead = resolve; });
      pendingRead = false;
    }
    return { data, error: null, count: null };
  }
}

async function emit(event, nextSession = session) {
  session = nextSession;
  await Promise.all(listeners.map((callback) => callback(event, session)));
}
window.__reviewsHarness = {
  refresh: () => emit('TOKEN_REFRESHED'),
  signOut: () => emit('SIGNED_OUT', null),
  signIn: () => emit('SIGNED_IN', { user: { id: 'auth-user' } }),
  holdNextRead: () => { holdNextRead = true; },
  releaseRead: () => releaseRead?.(),
  get pendingRead() { return pendingRead; }
};
export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => { await emit('SIGNED_IN', { user: { id: 'auth-user' } }); return { data: { session }, error: null }; },
      signOut: async () => { await emit('SIGNED_OUT', null); return { error: null }; },
      onAuthStateChange: (callback) => {
        listeners.push(callback);
        queueMicrotask(() => callback('INITIAL_SESSION', session));
        return { data: { subscription: { unsubscribe() {} } } };
      }
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

test('Revisões estabiliza sem loop de renderização ou consultas contínuas', async ({ page }) => {
  await page.goto('/revisoes.html');

  await expect(page.getByRole('heading', { name: 'Revisões', exact: true })).toBeVisible();
  await expect(page.locator('.review-v1-page')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Revisar agora' })).toBeVisible();
  await expect(page.locator('.review-v1-copy')).toContainText('09/08/2026, 07:00');

  await page.waitForTimeout(300);
  const firstCount = await page.evaluate(() => globalThis.__reviewQueryExecutions ?? 0);
  await page.waitForTimeout(500);
  const secondCount = await page.evaluate(() => globalThis.__reviewQueryExecutions ?? 0);

  expect(secondCount - firstCount).toBeLessThanOrEqual(1);
  await expect(page.locator('.review-v1-page')).toHaveCount(1);
});

test('a fila completa e o link de revisão permanecem após renovar a sessão', async ({ page }) => {
  await page.goto('/revisoes.html');
  const action = page.getByRole('link', { name: 'Revisar agora', exact: true });
  await expect(action).toHaveAttribute('href', /mode=review/);
  const count = await page.evaluate(() => globalThis.__reviewQueryExecutions);
  await page.evaluate(() => window.__reviewsHarness.refresh());
  await expect.poll(() => page.evaluate(() => globalThis.__reviewQueryExecutions)).toBeGreaterThan(count);
  await expect(page.locator('.review-v1-page')).toHaveCount(1);
  await expect(action).toHaveAttribute('href', /mode=review/);
});

test('entrar na mesma página monta a fila e sair remove as revisões privadas', async ({ page }) => {
  await page.addInitScript(() => { window.__startSignedOut = true; });
  await page.goto('/revisoes.html');
  await expect(page.getByRole('link', { name: 'Ir para o acesso' })).toBeVisible();
  await page.evaluate(() => window.__reviewsHarness.signIn());
  await expect(page.locator('.review-v1-page')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Revisar agora', exact: true })).toHaveAttribute('href', /mode=review/);
  await page.evaluate(() => window.__reviewsHarness.signOut());
  await expect(page.getByRole('link', { name: 'Ir para o acesso' })).toBeVisible();
  await expect(page.locator('.review-v1-page')).toHaveCount(0);
});

test('uma consulta lenta da sessão anterior não repõe a fila depois de sair', async ({ page }) => {
  await page.goto('/revisoes.html');
  await expect(page.locator('.review-v1-page')).toHaveCount(1);
  // Let the SDK's initial event finish before arranging the slow read.
  await expect(page.locator('#sessionIndicator')).toHaveText('Sessão ativa');
  await page.evaluate(() => window.__reviewsHarness.holdNextRead());
  await page.evaluate(() => window.__reviewsHarness.refresh());
  await expect.poll(() => page.evaluate(() => window.__reviewsHarness.pendingRead)).toBe(true);
  await page.evaluate(() => window.__reviewsHarness.signOut());
  await expect(page.getByRole('link', { name: 'Ir para o acesso' })).toBeVisible();
  await page.evaluate(() => window.__reviewsHarness.releaseRead());
  await expect.poll(() => page.evaluate(() => window.__reviewsHarness.pendingRead)).toBe(false);
  await expect(page.locator('.review-v1-page')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ir para o acesso' })).toBeVisible();
});
