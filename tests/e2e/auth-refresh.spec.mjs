import { test, expect } from '@playwright/test';

// Emulate Supabase's auth lock: an API call inside an awaited auth callback
// cannot finish until the callback releases that lock.
const MOCK_SUPABASE_MODULE = String.raw`
const listeners = [];
const waiting = [];
let locked = false;
let readsUnderLock = 0;
let queryCount = 0;
let session = window.__startSignedOut ? null : { user: { id: 'auth-student' } };
let studyUnits = [{ unit_id: 'U001', status: 'completed', mastery_percent: 100 }];
async function emit(event, nextSession) {
  session = nextSession;
  locked = true;
  try { await Promise.all(listeners.map((callback) => callback(event, session))); }
  finally {
    locked = false;
    waiting.splice(0).forEach((resolve) => resolve({ data: { session }, error: null }));
  }
}
class Query {
  constructor(table) { this.table = table; }
  select() { return this; }
  eq() { return this; }
  in() { return this; }
  order() { return this; }
  limit() { return this; }
  async maybeSingle() {
    queryCount += 1;
    return { data: session ? { id: 'STU-MYCHAEL', status: 'active', is_active: true } : null, error: null };
  }
  then(resolve, reject) {
    queryCount += 1;
    return Promise.resolve({ data: session && this.table === 'study_units' ? structuredClone(studyUnits) : [], error: null }).then(resolve, reject);
  }
}
const client = {
  auth: {
    getSession() {
      if (locked) {
        readsUnderLock += 1;
        return new Promise((resolve) => waiting.push(resolve));
      }
      return Promise.resolve({ data: { session }, error: null });
    },
    async signInWithPassword() {
      await emit('SIGNED_IN', { user: { id: 'auth-student' } });
      return { data: { session }, error: null };
    },
    async signOut() { await emit('SIGNED_OUT', null); return { error: null }; },
    onAuthStateChange(callback) {
      listeners.push(callback);
      return { data: { subscription: { unsubscribe() {} } } };
    }
  },
  from: (table) => new Query(table)
};
window.__authHarness = {
  signOut: () => client.auth.signOut(),
  signIn: () => client.auth.signInWithPassword(),
  clearProgress: () => { studyUnits = []; },
  get readsUnderLock() { return readsUnderLock; },
  get queryCount() { return queryCount; }
};
export function createClient() { return client; }
`;

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/supabase-client.js', (route) => route.fulfill({
    status: 200, contentType: 'text/javascript; charset=utf-8', body: MOCK_SUPABASE_MODULE
  }));
});

test('entrar e sair atualiza a tela sem consultar a sessão dentro do evento de autenticação', async ({ page }) => {
  await page.addInitScript(() => { window.__startSignedOut = true; });
  await page.goto('/configuracoes.html');
  await expect(page.locator('#sessionIndicator')).toHaveText('Acesso necessário');
  await page.getByLabel('E-mail').fill('student@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#sessionIndicator')).toHaveText('Sessão ativa');
  await page.locator('.auth-card').getByRole('button', { name: 'Sair', exact: true }).click();
  await expect(page.locator('#sessionIndicator')).toHaveText('Acesso necessário');
  await expect(page.getByLabel('E-mail')).toBeVisible();
  expect(await page.evaluate(() => window.__authHarness.readsUnderLock)).toBe(0);
});

test('o painel por concurso busca progresso novo após sair e entrar na mesma página', async ({ page }) => {
  await page.goto('/desempenho.html');
  const progress = page.locator('#competitionProgressPanel [data-scope="PMDF"] p');
  await expect(progress).toContainText('1 de');
  await page.evaluate(() => window.__authHarness.signOut());
  await expect(page.locator('#sessionIndicator')).toHaveText('Acesso necessário');
  await expect(page.locator('#competitionProgressPanel')).toHaveCount(0);
  await page.evaluate(async () => {
    window.__authHarness.clearProgress();
    await window.__authHarness.signIn();
  });
  await expect(page.locator('#sessionIndicator')).toHaveText('Sessão ativa');
  await expect(progress).toContainText('0 de');
  expect(await page.evaluate(() => window.__authHarness.readsUnderLock)).toBe(0);
});

test('atualizar o relógio do rodapé não consulta novamente o progresso do ciclo', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('.home-next-step')).not.toBeEmpty();
  await expect(page.locator('.live-clock')).toBeVisible();
  const counts = await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    // Allow the initial progressive rendering to finish.
    await frame();
    await frame();
    const before = window.__authHarness.queryCount;
    document.querySelector('.live-clock').textContent = 'Relógio atualizado';
    await frame();
    await frame();
    return { before, after: window.__authHarness.queryCount };
  });
  expect(counts.after).toBe(counts.before);
});
