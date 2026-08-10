import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REVIEW_INTERVALS,
  isSundayInBrasilia,
  nextReviewAt,
  nextReviewInterval,
  normalizeReviewDate
} from '../assets/review-schedule.js';

test('âncoras de revisão preservam a progressão do projeto', () => {
  assert.deepEqual(REVIEW_INTERVALS, [1, 7, 15, 30, 60, 90, 180]);
  assert.equal(nextReviewInterval(1), 7);
  assert.equal(nextReviewInterval(7), 15);
  assert.equal(nextReviewInterval(15), 30);
  assert.equal(nextReviewInterval(30), 60);
  assert.equal(nextReviewInterval(60), 90);
  assert.equal(nextReviewInterval(90), 180);
  assert.equal(nextReviewInterval(180), 180);
});

test('revisão que cair no domingo passa ao próximo dia ativo', () => {
  const sunday = new Date('2026-08-09T15:00:00Z');
  assert.equal(isSundayInBrasilia(sunday), true);
  const normalized = normalizeReviewDate(sunday);
  assert.equal(isSundayInBrasilia(normalized), false);
  assert.equal(normalized.toISOString(), '2026-08-10T15:00:00.000Z');
});

test('próxima revisão usa a âncora e normaliza domingo', () => {
  const saturday = new Date('2026-08-08T15:00:00Z');
  assert.equal(nextReviewAt(1, saturday), '2026-08-10T15:00:00.000Z');
});
