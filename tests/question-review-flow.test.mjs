import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { nextReviewAt, nextReviewInterval } from '../assets/review-schedule.js';
import { isReviewDue } from '../assets/study-cycle.js';

const source = await readFile(new URL('../assets/question-flow-fix.js', import.meta.url), 'utf8');
const question = { id: 'Q1', unitId: 'U1', answer: 'A' };
const unit = { id: 'U1', questionIds: ['Q1'], questionSetIds: ['QS1'] };

function setup(review, errors = []) {
  const db = {
    student_profiles: [{ id: 'student', status: 'active' }],
    study_units: [{ id: 'study', profile_id: 'student', unit_id: 'U1', status: 'in_progress' }],
    question_attempts: [],
    error_items: errors,
    review_items: review ? [{ id: 'review', profile_id: 'student', source_type: 'question', source_id: 'Q1', ...review }] : []
  };
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.action = 'select'; }
    select(_columns, options = {}) { this.head = options.head; return this; }
    eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
    in(column, values) { this.filters.push((row) => values.includes(row[column])); return this; }
    order() { return this; }
    limit() { return this; }
    insert(payload) { this.action = 'insert'; this.payload = payload; return this; }
    update(payload) { this.action = 'update'; this.payload = payload; return this; }
    upsert(payload) { this.action = 'upsert'; this.payload = payload; return this; }
    async maybeSingle() { const result = this.execute(); return { ...result, data: result.data?.[0] ?? null }; }
    single() { return this.maybeSingle(); }
    then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); }
    execute() {
      const rows = db[this.table];
      let selected = rows.filter((row) => this.filters.every((filter) => filter(row)));
      if (this.action === 'insert') {
        const row = { ...this.payload, id: `row-${rows.length + 1}`, answered_at: new Date().toISOString() };
        rows.unshift(row);
        selected = [row];
      } else if (this.action === 'update') {
        selected.forEach((row) => Object.assign(row, this.payload));
      } else if (this.action === 'upsert') {
        const existing = rows.find((row) => row.source_id === this.payload.source_id);
        if (existing) Object.assign(existing, this.payload);
        else rows.push({ id: `row-${rows.length + 1}`, ...this.payload });
      }
      return { data: this.head ? null : structuredClone(selected), error: null, count: selected.length };
    }
  }
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user' } } }, error: null }) },
    from: (table) => new Query(table)
  };
  // Execute the actual browser module with its imports and DOM entry point stubbed.
  const context = vm.createContext({
    createClient: () => client, supabaseConfig: { profileId: 'student' },
    nextReviewAt, nextReviewInterval, isReviewDue,
    loadCatalog: async () => ({ questions: [question], units: [unit] }),
    document: { body: { dataset: { page: 'questions' } }, readyState: 'loading', addEventListener() {} },
    Date, Map, Set, crypto, console
  });
  vm.runInContext(source.replace(/^import .*;\n/gm, ''), context);
  return { db, save: (answer = 'A', mode = 'review') => context.saveAttempt(question, unit, answer, mode) };
}

const overdue = () => ({ status: 'scheduled', repetitions: 0, interval_days: 1, next_review_at: '2020-01-01T12:00:00.000Z' });

test('answering a due review twice saves both attempts but advances the schedule only once', async () => {
  const { db, save } = setup(overdue());
  await save();
  const scheduled = structuredClone(db.review_items[0]);
  assert.equal(scheduled.interval_days, 7);
  assert.equal(scheduled.repetitions, 1);
  await save();
  assert.equal(db.question_attempts.length, 2);
  assert.deepEqual(db.review_items[0], scheduled);
});

test('early practice preserves the scheduled date, interval and repetition count', async () => {
  const future = { status: 'scheduled', repetitions: 4, interval_days: 30, next_review_at: '2099-01-01T12:00:00.000Z' };
  const { db, save } = setup(future);
  await save();
  assert.equal(db.question_attempts.length, 1);
  assert.equal(db.review_items[0].next_review_at, future.next_review_at);
  assert.equal(db.review_items[0].repetitions, 4);
});

test('completed or paused reviews do not resume automatically when practicing', async () => {
  for (const status of ['completed', 'paused']) {
    const { db, save } = setup({ ...overdue(), status });
    await save();
    assert.equal(db.review_items[0].status, status);
    assert.equal(db.review_items[0].repetitions, 0);
  }
});

test('a correct answer outside review mode advances an existing due review', async () => {
  const { db, save } = setup(overdue());
  await save('A', 'all');
  assert.equal(db.review_items[0].interval_days, 7);
  assert.equal(db.review_items[0].repetitions, 1);
});

test('a wrong answer still resets the corrective interval and opens an error', async () => {
  const { db, save } = setup({ ...overdue(), interval_days: 30, repetitions: 3 });
  await save('B');
  assert.equal(db.error_items[0].status, 'open');
  assert.equal(db.review_items[0].interval_days, 1);
  assert.equal(db.review_items[0].repetitions, 3);
  assert.equal(db.study_units[0].status, 'in_progress');
});

test('correcting an open error resolves it and schedules a seven-day review', async () => {
  const { db, save } = setup(overdue(), [{ id: 'error', profile_id: 'student', question_id: 'Q1', status: 'open' }]);
  await save();
  assert.equal(db.error_items[0].status, 'resolved');
  assert.equal(db.review_items[0].interval_days, 7);
  assert.equal(db.review_items[0].reason, 'spaced_review_after_correction');
  assert.equal(db.study_units[0].status, 'completed');
});
