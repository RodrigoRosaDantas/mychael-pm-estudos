import { test, expect } from '@playwright/test';

const MOCK_SUPABASE_MODULE = String.raw`
const empty = { data: [], error: null };
class Query {
  select() { return this; }
  eq() { return this; }
  in() { return this; }
  order() { return this; }
  limit() { return this; }
  async maybeSingle() { return { data: null, error: null }; }
  then(resolve) { return Promise.resolve(empty).then(resolve); }
}
const client = {
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInWithPassword: async () => ({ data: { session: null }, error: null }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
  },
  from: () => new Query()
};
export function createClient() { return client; }
`;

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/supabase-client.js', async (route) => {
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: MOCK_SUPABASE_MODULE });
  });
});

test('home usa horário de Brasília e conta o TAF histórico publicado', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-09T04:54:00.000Z'));
  await page.goto('/index.html');

  await expect(page.locator('.live-clock')).toContainText('09 de agosto de 2026 às 01:54');
  const metric = page.locator('.metric-card').filter({ hasText: 'referências históricas de TAF' });
  await expect(metric.locator('strong')).toHaveText('7');
});

test('cronograma e aplicabilidade não ativam a rotação antes do O7', async ({ page }) => {
  await page.goto('/cronograma.html');
  await expect(page.getByRole('heading', { name: 'Rotação específica ainda desativada' })).toBeVisible();

  await page.goto('/estudar.html?unit=U038');
  await expect(page.getByText('Específica de uma corporação', { exact: true })).toBeVisible();
  await expect(page.locator('.coverage-badge[aria-label="PMGO: aplica-se"]')).toBeVisible();
  await expect(page.locator('.coverage-badge[aria-label="PMDF: não se aplica"]')).toBeVisible();
  await expect(page.locator('.coverage-badge[aria-label="PMMG: não se aplica"]')).toBeVisible();
});

test('páginas auditadas não criam rolagem horizontal no celular', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium');
  for (const path of ['/index.html', '/materias.html', '/provas.html', '/taf.html']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} não deve ultrapassar a largura do celular`).toBeLessThanOrEqual(1);
  }
});
