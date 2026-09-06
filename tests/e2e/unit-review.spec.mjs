import { test, expect } from '@playwright/test';

const MOCK_SUPABASE_MODULE = String.raw`
const key = 'unit-review-test-db';
let session = window.__unitStartSignedOut ? null : { user: { id: 'test-user' } };
const listeners = [];
let rejectUpdate = false;
let loseResponse = false;
let writes = 0;
let holdErrors = false;
let pendingRead = false;
let releaseRead;
const db = JSON.parse(sessionStorage.getItem(key) || 'null') || {
  student_profiles: [{ id: 'STU-MYCHAEL', status: 'active', is_active: true }],
  study_units: [{ id: 'study-1', profile_id: 'STU-MYCHAEL', unit_id: 'U001', status: 'completed', mastery_percent: 100, completed_at: '2020-01-01T12:00:00.000Z' }],
  error_items: [],
  review_items: [{ id: 'review-1', profile_id: 'STU-MYCHAEL', source_type: 'unit', source_id: 'U001', status: 'scheduled', repetitions: 0, interval_days: 7, next_review_at: '2020-01-08T12:00:00.000Z', updated_at: '2020-01-01T12:00:00.000Z' }]
};
class Query {
  constructor(table) { this.table = table; this.filters = []; }
  select() { return this; }
  eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
  in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
  order() { return this; }
  upsert() { return this; }
  update(payload) { this.payload = payload; return this; }
  async maybeSingle() { const result = await this.execute(); return { ...result, data: result.data?.[0] ?? null }; }
  then(resolve, reject) { return this.execute().then(resolve, reject); }
  async execute() {
    let rows = session ? (db[this.table] || []).filter((row) => this.filters.every((filter) => filter(row))) : [];
    if (this.payload) {
      writes += 1;
      if (rejectUpdate) rows = [];
      rows.forEach((row) => Object.assign(row, this.payload, { updated_at: new Date().toISOString() }));
      sessionStorage.setItem(key, JSON.stringify(db));
      if (loseResponse) { loseResponse = false; return { data: null, error: new Error('Connection lost after commit') }; }
    }
    const data = structuredClone(rows);
    if (this.table === 'error_items' && holdErrors) {
      holdErrors = false;
      pendingRead = true;
      await new Promise((resolve) => { releaseRead = resolve; });
      pendingRead = false;
    }
    return { data, error: null };
  }
}
async function emit(event, nextSession = session) {
  session = nextSession;
  await Promise.all(listeners.map((listener) => listener(event, session)));
}
globalThis.__unitReviewTest = {
  get review() { return structuredClone(db.review_items[0]); },
  get writes() { return writes; },
  rejectUpdate() { rejectUpdate = true; },
  loseResponse() { loseResponse = true; },
  refresh: () => emit('TOKEN_REFRESHED'),
  signIn: () => emit('SIGNED_IN', { user: { id: 'test-user' } }),
  signOut: () => emit('SIGNED_OUT', null),
  holdErrors() { holdErrors = true; },
  releaseRead() { releaseRead?.(); },
  get pendingRead() { return pendingRead; }
};
export function createClient() {
  return { from: (table) => new Query(table), auth: {
    getSession: async () => ({ data: { session }, error: null }),
    signOut: async () => { await emit('SIGNED_OUT', null); return { error: null }; },
    onAuthStateChange(callback) {
      listeners.push(callback);
      queueMicrotask(() => callback('INITIAL_SESSION', session));
      return { data: { subscription: { unsubscribe() {} } } };
    }
  } };
}
`;

const reviewUrl = '/estudar.html?unit=U001&mode=review';

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/supabase-client.js', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript; charset=utf-8', body: MOCK_SUPABASE_MODULE
  }));
});

test('concluir a revisão confirma a gravação e reabrir a unidade preserva o próximo prazo', async ({ page }) => {
  await page.goto(reviewUrl);
  await page.getByRole('button', { name: 'Concluir revisão', exact: true }).click();
  await expect(page).toHaveURL(/\/revisoes\.html$/);
  await expect(page.getByRole('link', { name: 'Revisar unidade', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => globalThis.__unitReviewTest.review);
  expect(saved.repetitions).toBe(1);
  expect(saved.interval_days).toBe(15);
  await page.getByRole('link', { name: 'Revisar unidade', exact: true }).click();
  await expect(page.locator('[data-unit-review-panel]')).toContainText('A próxima revisão já está agendada');
  await expect(page.getByRole('button', { name: 'Concluir revisão', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => globalThis.__unitReviewTest.review)).toEqual(saved);
});

test('zero registros atualizados mantém a página e informa que a revisão não foi confirmada', async ({ page }) => {
  await page.goto(reviewUrl);
  const button = page.getByRole('button', { name: 'Concluir revisão', exact: true });
  await expect(button).toBeVisible();
  await page.evaluate(() => globalThis.__unitReviewTest.rejectUpdate());
  await button.click();
  await expect(page.locator('.unit-review-card .inline-status')).toContainText('A revisão mudou ou não está mais disponível');
  await expect(page).toHaveURL(/estudar\.html\?unit=U001&mode=review$/);
  expect((await page.evaluate(() => globalThis.__unitReviewTest.review)).repetitions).toBe(0);
});

test('tentar novamente após perder a resposta do servidor não duplica a conclusão', async ({ page }) => {
  await page.goto(reviewUrl);
  await expect(page.getByRole('button', { name: 'Concluir revisão', exact: true })).toBeVisible();
  await page.evaluate(() => globalThis.__unitReviewTest.loseResponse());
  await page.getByRole('button', { name: 'Concluir revisão', exact: true }).click();
  await expect(page.locator('.unit-review-card .inline-status')).toContainText('Não foi possível confirmar a revisão');
  const saved = await page.evaluate(() => globalThis.__unitReviewTest.review);
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.locator('.unit-review-card .inline-status')).toContainText('Esta revisão não está devida');
  expect(await page.evaluate(() => globalThis.__unitReviewTest.review)).toEqual(saved);
  expect(await page.evaluate(() => globalThis.__unitReviewTest.writes)).toBe(1);
});

test('o painel de revisão acompanha entrada, renovação da sessão e saída', async ({ page }) => {
  await page.addInitScript(() => { window.__unitStartSignedOut = true; });
  await page.goto(reviewUrl);
  await expect(page.locator('#sessionIndicator')).toHaveText('Acesso necessário');
  await expect(page.locator('[data-unit-review-panel]')).toHaveCount(0);
  await page.evaluate(() => globalThis.__unitReviewTest.signIn());
  await expect(page.getByRole('button', { name: 'Concluir revisão', exact: true })).toBeVisible();
  await page.evaluate(() => globalThis.__unitReviewTest.refresh());
  await expect(page.locator('[data-unit-review-panel]')).toHaveCount(1);
  await page.evaluate(() => globalThis.__unitReviewTest.signOut());
  await expect(page.locator('#sessionIndicator')).toHaveText('Acesso necessário');
  await expect(page.locator('[data-unit-review-panel]')).toHaveCount(0);
});

test('sair enquanto a conclusão consulta pendências impede a gravação atrasada', async ({ page }) => {
  await page.goto(reviewUrl);
  await expect(page.getByRole('button', { name: 'Concluir revisão', exact: true })).toBeVisible();
  await page.evaluate(() => globalThis.__unitReviewTest.holdErrors());
  await page.getByRole('button', { name: 'Concluir revisão', exact: true }).click();
  await expect.poll(() => page.evaluate(() => globalThis.__unitReviewTest.pendingRead)).toBe(true);
  await page.evaluate(() => globalThis.__unitReviewTest.signOut());
  await expect(page.locator('#sessionIndicator')).toHaveText('Acesso necessário');
  await page.evaluate(() => globalThis.__unitReviewTest.releaseRead());
  await expect.poll(() => page.evaluate(() => globalThis.__unitReviewTest.pendingRead)).toBe(false);
  expect(await page.evaluate(() => globalThis.__unitReviewTest.writes)).toBe(0);
  await expect(page.locator('[data-unit-review-panel]')).toHaveCount(0);
});
