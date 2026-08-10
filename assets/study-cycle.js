export const BRASILIA_TIME_ZONE = 'America/Sao_Paulo';

export function flattenStudyCycle(plan) {
  return (plan?.cycles ?? []).flatMap((cycle) =>
    (cycle.sessions ?? []).map((session, index) => ({
      ...session,
      cycleId: cycle.id,
      cycleNumber: cycle.number,
      positionInCycle: index + 1
    }))
  );
}

export function studyCycleUnitIds(plan) {
  return flattenStudyCycle(plan).map(({ unitId }) => unitId);
}

export function openErrorUnitIds(catalog, openErrorQuestionIds = []) {
  const questionToUnit = new Map((catalog?.questions ?? []).map((question) => [question.id, question.unitId]));
  return new Set(openErrorQuestionIds.map((id) => questionToUnit.get(id)).filter(Boolean));
}

export function deriveStudyCycleProgress({ plan, catalog, studyUnits = [], openErrorQuestionIds = [] }) {
  const sessions = flattenStudyCycle(plan);
  const studyByUnit = new Map((studyUnits ?? []).map((row) => [row.unit_id, row]));
  const blockedByError = openErrorUnitIds(catalog, openErrorQuestionIds);
  const completedUnitIds = new Set();

  for (const session of sessions) {
    const row = studyByUnit.get(session.unitId);
    if (row?.status === 'completed' && !blockedByError.has(session.unitId)) completedUnitIds.add(session.unitId);
  }

  const currentIndex = sessions.findIndex((session) => !completedUnitIds.has(session.unitId));
  const completedSessions = currentIndex === -1 ? sessions.length : currentIndex;
  const current = currentIndex === -1 ? null : sessions[currentIndex];

  return {
    sessions,
    current,
    currentIndex,
    completedSessions,
    totalSessions: sessions.length,
    completedUnitIds,
    blockedByError,
    checkpointDue: sessions.length > 0 && completedSessions >= sessions.length,
    percent: sessions.length ? Math.round((completedSessions / sessions.length) * 100) : 0
  };
}

export function isSundayInBrasilia(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: BRASILIA_TIME_ZONE
  }).format(date);
  return weekday === 'Sun';
}

export function isReviewDue(item, now = Date.now()) {
  if (item?.status === 'due') return true;
  if (!item?.next_review_at) return false;
  const dueAt = new Date(item.next_review_at).getTime();
  return Number.isFinite(dueAt) && dueAt <= now;
}
