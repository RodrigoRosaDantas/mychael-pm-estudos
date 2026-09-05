import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadFetch } from '../assets/supabase-read-fetch.js';

const project = 'https://example.supabase.co';
const table = `${project}/rest/v1/question_attempts?select=question_id,is_correct&profile_id=eq.student`;
const request = { method: 'GET', headers: { Authorization: 'Bearer student-a', apikey: 'public-test-key' } };

function transport() {
  const calls = [];
  const fetch = (input, init) => new Promise((resolve, reject) => calls.push({ input, init, resolve, reject }));
  const respond = (index, data, options = {}) => calls[index].resolve(new Response(
    data === null ? null : JSON.stringify(data),
    { headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' }, ...options }
  ));
  return { calls, fetch, respond };
}

// Allow the deferred transport to start without relying on network timing.
const started = () => new Promise((resolve) => setImmediate(resolve));

test('concurrent identical reads share one request and have independent response bodies', async () => {
  const network = transport();
  const reads = createReadFetch(project, network.fetch);
  const first = reads.fetch(table, request);
  const second = reads.fetch(new URL(table), { ...request, headers: [['apikey', 'public-test-key'], ['authorization', 'Bearer student-a']] });
  await started();
  assert.equal(network.calls.length, 1);
  network.respond(0, [{ question_id: 'Q1', is_correct: true }]);
  const [a, b] = await Promise.all([first, second]);
  assert.notEqual(a, b);
  assert.equal(a.headers.get('content-range'), '0-0/1');
  assert.deepEqual(await a.json(), await b.json());
});

test('tokens, query filters, schema, ranges and request options remain isolated', async () => {
  const network = transport();
  const reads = createReadFetch(project, network.fetch);
  const variants = [
    [table, request],
    [table.replace('eq.student', 'eq.other'), request],
    [table, { ...request, headers: { ...request.headers, Authorization: 'Bearer student-b' } }],
    [table, { ...request, headers: { ...request.headers, 'Accept-Profile': 'other_schema' } }],
    [table, { ...request, headers: { ...request.headers, Range: '10-19' } }],
    [table, { ...request, headers: { ...request.headers, apikey: 'other-public-key' } }],
    [table, { ...request, cache: 'reload' }],
    [table, { ...request, credentials: 'omit' }]
  ];
  const requests = variants.map(([url, init]) => reads.fetch(url, init));
  await started();
  assert.equal(network.calls.length, variants.length);
  variants.forEach((_, index) => network.respond(index, { index }));
  assert.deepEqual(await Promise.all(requests.map(async (result) => (await result).json())), variants.map((_, index) => ({ index })));
});

test('HEAD count reads are shared without being mixed with GET responses', async () => {
  const network = transport();
  const reads = createReadFetch(project, network.fetch);
  const requests = [reads.fetch(table, { ...request, method: 'HEAD' }), reads.fetch(table, { ...request, method: 'HEAD' }), reads.fetch(table, request)];
  await started();
  assert.equal(network.calls.length, 2);
  network.respond(0, null);
  network.respond(1, []);
  const responses = await Promise.all(requests);
  assert.equal(await responses[0].text(), '');
  assert.equal(responses[1].headers.get('content-range'), '0-0/1');
  assert.deepEqual(await responses[2].json(), []);
});

test('a completed read is never used as a cache of private progress', async () => {
  let version = 0;
  const reads = createReadFetch(project, async () => Response.json({ version: ++version }));
  assert.deepEqual(await (await reads.fetch(table, request)).json(), { version: 1 });
  assert.deepEqual(await (await reads.fetch(table, request)).json(), { version: 2 });
});

test('network failures are shared only while pending and allow a fresh retry', async () => {
  const network = transport();
  const reads = createReadFetch(project, network.fetch);
  const results = Promise.allSettled([reads.fetch(table, request), reads.fetch(table, request)]);
  await started();
  network.calls[0].reject(new TypeError('Network unavailable'));
  for (const result of await results) {
    assert.equal(result.status, 'rejected');
    assert.match(result.reason.message, /Network unavailable/);
  }
  const retry = reads.fetch(table, request);
  await started();
  assert.equal(network.calls.length, 2);
  network.respond(1, []);
  await retry;
});

test('HTTP errors keep their status and body and are not cached', async () => {
  let calls = 0;
  const reads = createReadFetch(project, async () => {
    calls += 1;
    return Response.json({ message: 'Session expired' }, { status: 401, statusText: 'Unauthorized' });
  });
  const responses = await Promise.all([reads.fetch(table, request), reads.fetch(table, request)]);
  assert.equal(calls, 1);
  for (const response of responses) {
    assert.equal(response.status, 401);
    assert.equal(response.statusText, 'Unauthorized');
    assert.deepEqual(await response.json(), { message: 'Session expired' });
  }
  await reads.fetch(table, request);
  assert.equal(calls, 2);
});

test('session invalidation separates pending reads, including a return to the same token', async () => {
  const network = transport();
  const reads = createReadFetch(project, network.fetch);
  const old = reads.fetch(table, request);
  reads.invalidate();
  const current = reads.fetch(table, request);
  await started();
  network.respond(0, { version: 'old' });
  await old;
  const shared = reads.fetch(table, request);
  await started();
  // Completion of the invalidated request must not remove the new request.
  assert.equal(network.calls.length, 2);
  network.respond(1, { version: 'current' });
  for (const response of await Promise.all([current, shared])) assert.deepEqual(await response.json(), { version: 'current' });
});

test('writes stay independent and reads made before or during writes cannot be reused afterward', async () => {
  const network = transport();
  const reads = createReadFetch(project, network.fetch);
  const old = reads.fetch(table, request);
  await started();
  const writeOptions = { method: 'POST', headers: request.headers, body: JSON.stringify({ is_correct: true }) };
  const writes = [reads.fetch(table, writeOptions), reads.fetch(table, writeOptions)];
  const during = [reads.fetch(table, request), reads.fetch(table, request)];
  await started();
  assert.equal(network.calls.length, 5);
  network.respond(1, null, { status: 201 });
  network.respond(2, null, { status: 201 });
  await Promise.all(writes);
  const after = reads.fetch(table, request);
  await started();
  assert.equal(network.calls.length, 6);
  network.respond(0, { version: 'before' });
  network.respond(3, { version: 'during' });
  network.respond(4, { version: 'during' });
  await Promise.all([old, ...during]);
  const sharedAfter = reads.fetch(table, request);
  await started();
  assert.equal(network.calls.length, 6);
  network.respond(5, { version: 'after' });
  for (const response of await Promise.all([after, sharedAfter])) assert.deepEqual(await response.json(), { version: 'after' });
});

test('a failed write releases the barrier for subsequent reads', async () => {
  const network = transport();
  const reads = createReadFetch(project, network.fetch);
  const failed = assert.rejects(reads.fetch(table, { method: 'PATCH', body: '{}' }), /Write failed/);
  network.calls[0].reject(new Error('Write failed'));
  await failed;
  const results = [reads.fetch(table, request), reads.fetch(table, request)];
  await started();
  assert.equal(network.calls.length, 2);
  network.respond(1, []);
  await Promise.all(results);
});

test('cancelling one read does not cancel another reader', async () => {
  const controller = new AbortController();
  let calls = 0;
  const reads = createReadFetch(project, (_url, init) => {
    calls += 1;
    if (!init.signal) return Promise.resolve(Response.json(['available']));
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  });
  const cancelled = assert.rejects(reads.fetch(table, { ...request, signal: controller.signal }), { name: 'AbortError' });
  const independent = reads.fetch(table, request);
  controller.abort();
  await cancelled;
  assert.deepEqual(await (await independent).json(), ['available']);
  assert.equal(calls, 2);
});

test('auth, storage, RPC, external URLs, Request objects and custom options are passed through', async () => {
  const variants = [
    [`${project}/auth/v1/user`, request],
    [`${project}/storage/v1/object`, request],
    [`${project}/rest/v1/rpc/read_progress`, request],
    ['https://other.supabase.co/rest/v1/question_attempts', request],
    [new Request(table, request), undefined],
    [table, { ...request, signal: new AbortController().signal }],
    [table, { ...request, customOption: true }]
  ];
  for (const [url, init] of variants) {
    const network = transport();
    const reads = createReadFetch(project, network.fetch);
    const results = [reads.fetch(url, init), reads.fetch(url, init)];
    await started();
    assert.equal(network.calls.length, 2, String(url));
    network.respond(0, []);
    network.respond(1, []);
    await Promise.all(results);
  }
});
