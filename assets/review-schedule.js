export const REVIEW_INTERVALS = Object.freeze([1, 7, 15, 30, 60, 90, 180]);
export const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';
const DAY_MS = 86_400_000;

export function nextReviewInterval(currentIntervalDays = 1) {
  const current = Number(currentIntervalDays) || 1;
  return REVIEW_INTERVALS.find((interval) => interval > current) ?? REVIEW_INTERVALS.at(-1);
}

export function isSundayInBrasilia(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: BRASILIA_TIME_ZONE
  }).format(date);
  return weekday === 'Sun';
}

export function normalizeReviewDate(date) {
  let candidate = new Date(date);
  while (isSundayInBrasilia(candidate)) candidate = new Date(candidate.getTime() + DAY_MS);
  return candidate;
}

export function nextReviewAt(intervalDays, now = new Date()) {
  const base = now instanceof Date ? now : new Date(now);
  return normalizeReviewDate(new Date(base.getTime() + Number(intervalDays) * DAY_MS)).toISOString();
}
