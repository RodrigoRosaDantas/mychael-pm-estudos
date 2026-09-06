import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { REVIEW_INTERVALS, nextReviewAt, nextReviewInterval } from '../assets/review-schedule.js';
import { isReviewDue } from '../assets/study-cycle.js';

const source = await readFile(new URL('../assets/unit-review.js', import.meta.url), 'utf8');
const dueReview = () => ({
  id: 'review-1', profile_id: 'student', source_type: 'unit', source_id: 'U1',
  status: 'scheduled', repetitions: 0, interval_days: 7,
  next_review_at: '2020-01-01T12:00:00.000Z', updated_at: '2020-01-01T00:00:00.000Z'
});

function setup(review = dueReview()) {
  const state = { review, signedIn: true, visible: true, fail: null, writes: 0 };
  class Query {
    constructor(table) { this.table = table; this.filters = []; }
    select() { return this; }
    eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
    update(payload) { this.payload = payload; return this; }
    async maybeSingle() { const result = this.execute(); return { ...result, data: result.data?.[0] ?? null }; }
    then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
    execute() {
      if (this.table === 'student_profiles') return { data: state.signedIn ? [{ id: 'student', is_active: true }] : [], error: null };
      const rows = state.visible && state.review && this.filters.every((filter) => filter(state.review)) ? [state.review] : [];
      if (this.payload) {
        state.writes += 1;
        if (state.fail === 'before') return { data: null, error: new Error('Connection lost') };
        rows.forEach((row) => Object.assign(row, this.payload, { updated_at: new Date().toISOString() }));
        if (state.fail === 'after') { state.fail = null; return { data: null, error: new Error('Connection lost') }; }
      }
      return { data: structuredClone(rows), error: null };
    }
  }
  const client = {
    auth: { getSession: async () => ({ data: { session: state.signedIn ? { user: { id: 'user' } } : null }, error: null }) },
    from: (table) => new Query(table)
  };
  const context = vm.createContext({
    createClient: () => client, supabaseConfig: { profileId: 'student' },
    REVIEW_INTERVALS, nextReviewAt, nextReviewInterval, isReviewDue,
    loadCatalog: async () => ({ units: [] }),
    document: { body: { dataset: { page: 'questions' } }, readyState: 'loading', addEventListener() {} },
    Date, Set, console
  });
  vm.runInContext(source.replace(/^import .*;\n/gm, '').replace(/^export /gm, ''), context);
  return { state, context, advance: (snapshot = structuredClone(state.review)) => context.advanceUnitReview(snapshot) };
}

test('a due unit review advances once and requires a returned database row', async () => {
  const { state, advance } = setup();
  await advance();
  assert.equal(state.writes, 1);
  assert.equal(state.review.interval_days, 15);
  assert.equal(state.review.repetitions, 1);
  assert.equal(state.review.status, 'scheduled');
});

test('future, paused and completed unit reviews cannot advance', async () => {
  for (const review of [
    { ...dueReview(), next_review_at: '2099-01-01T12:00:00.000Z' },
    { ...dueReview(), status: 'paused' },
    { ...dueReview(), status: 'completed' }
  ]) {
    const { state, advance } = setup(review);
    await assert.rejects(advance());
    assert.equal(state.writes, 0);
    assert.equal(state.review.repetitions, 0);
  }
});

test('an update matching zero rows is not reported as a completed review', async () => {
  const { state, advance } = setup();
  state.visible = false;
  await assert.rejects(advance());
  assert.equal(state.review.repetitions, 0);
});

test('two completions using the same snapshot cannot overwrite the newer schedule', async () => {
  const { state, advance } = setup();
  const snapshot = structuredClone(state.review);
  const outcomes = await Promise.allSettled([advance(snapshot), advance(snapshot)]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(state.review.repetitions, 1);
});

test('a row changed by another tab is preserved', async () => {
  const { state, advance } = setup();
  const old = structuredClone(state.review);
  state.review.status = 'paused';
  state.review.updated_at = '2026-09-06T00:00:00.000Z';
  await assert.rejects(advance(old));
  assert.equal(state.review.status, 'paused');
  assert.equal(state.review.repetitions, 0);
});

test('retry after a committed write loses its response does not advance again', async () => {
  const { state, advance } = setup();
  state.fail = 'after';
  await assert.rejects(advance(), /Connection lost/);
  const saved = structuredClone(state.review);
  await assert.rejects(advance());
  assert.deepEqual(state.review, saved);
  assert.equal(state.writes, 1);
});

test('a failure before writing preserves the old schedule and allows retry', async () => {
  const { state, advance } = setup();
  const original = structuredClone(state.review);
  state.fail = 'before';
  await assert.rejects(advance(), /Connection lost/);
  assert.deepEqual(state.review, original);
  state.fail = null;
  await advance();
  assert.equal(state.review.repetitions, 1);
});

test('profile checks recover after login and stop authorizing after logout', async () => {
  const { state, context } = setup();
  state.signedIn = false;
  assert.equal(await context.hasActiveProfile(), false);
  state.signedIn = true;
  assert.equal(await context.hasActiveProfile(), true);
  state.signedIn = false;
  assert.equal(await context.hasActiveProfile(), false);
});
