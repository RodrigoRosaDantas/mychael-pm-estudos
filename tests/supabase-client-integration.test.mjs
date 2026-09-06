import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;

test('the shared Supabase client preserves options and invalidates pending reads on auth events', async () => {
  // Replace only the remote SDK dependency; run the actual application wrapper.
  const sdkUrl = moduleUrl(`
    export const clients = [];
    export function createClient(url, key, options) {
      const listeners = [];
      const client = { url, key, options, listeners,
        auth: { onAuthStateChange(callback) { listeners.push(callback); } },
        from(table) { return { table }; }
      };
      clients.push(client);
      return client;
    }
  `);
  const source = await readFile(new URL('../assets/supabase-client.js', import.meta.url), 'utf8');
  const wrapperSource = source
    .replace('https://esm.sh/@supabase/supabase-js@2.112.2', sdkUrl)
    .replace('./supabase-read-fetch.js', new URL('../assets/supabase-read-fetch.js', import.meta.url).href);
  const { createClient } = await import(moduleUrl(wrapperSource));
  const { clients } = await import(sdkUrl);
  const pending = [];
  const customFetch = (_input, init) => new Promise((resolve) => pending.push({ init, resolve }));
  const auth = { persistSession: false, detectSessionInUrl: false };
  const headers = { 'X-Application': 'test' };
  const client = createClient('https://integration.supabase.co', 'public-test-key', { auth, global: { headers, fetch: customFetch } });
  assert.equal(createClient('https://integration.supabase.co', 'public-test-key'), client);
  assert.equal(clients.length, 1);
  assert.equal(clients[0].options.auth, auth);
  assert.equal(clients[0].options.global.headers, headers);
  assert.equal(client.from('question_attempts').table, 'question_attempts');
  const fetch = clients[0].options.global.fetch;
  const url = 'https://integration.supabase.co/rest/v1/study_units';
  const options = { headers: { Authorization: 'Bearer student' } };
  const old = [fetch(url, options), fetch(url, options)];
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 1);
  assert.equal(pending[0].init, options);
  for (const listener of clients[0].listeners) assert.equal(listener('SIGNED_OUT', null), undefined);
  const fresh = fetch(url, options);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending.length, 2);
  pending[0].resolve(Response.json(['old']));
  pending[1].resolve(Response.json(['fresh']));
  for (const response of await Promise.all(old)) assert.deepEqual(await response.json(), ['old']);
  assert.deepEqual(await (await fresh).json(), ['fresh']);
});
