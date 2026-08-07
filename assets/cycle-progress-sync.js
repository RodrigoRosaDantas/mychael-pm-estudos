import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';

const CATALOG_URL = './content/catalog.json';
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

let timer = null;
let syncing = false;
let rerun = false;
let catalogPromise = null;

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('Catálogo indisponível para sincronizar o ciclo.');
      return response.json();
    });
  }
  return catalogPromise;
}

function latestAttemptsByQuestion(attempts) {
  const latest = new Map();
  for (const attempt of attempts ?? []) {
    if (!attempt?.question_id) continue;
    const previous = latest.get(attempt.question_id);
    const previousAt = new Date(previous?.answered_at ?? 0).getTime();
    const currentAt = new Date(attempt.answered_at ?? 0).getTime();
    if (!previous || currentAt >= previousAt) latest.set(attempt.question_id, attempt);
  }
  return latest;
}

async function syncProgress() {
  if (syncing) {
    rerun = true;
    return;
  }
  syncing = true;
  try {
    const [{ data: sessionData, error: sessionError }, catalog] = await Promise.all([
      supabase.auth.getSession(),
      loadCatalog()
    ]);
    if (sessionError || !sessionData.session?.user) return;

    const { data: profile, error: profileError } = await supabase
      .from('student_profiles')
      .select('id, status')
      .eq('id', supabaseConfig.profileId)
      .maybeSingle();
    if (profileError || profile?.status !== 'active') return;

    const [unitsResult, attemptsResult, errorsResult] = await Promise.all([
      supabase
        .from('study_units')
        .select('id, unit_id, status, mastery_percent, completed_at')
        .eq('profile_id', supabaseConfig.profileId),
      supabase
        .from('question_attempts')
        .select('question_id, unit_id, is_correct, answered_at')
        .eq('profile_id', supabaseConfig.profileId),
      supabase
        .from('error_items')
        .select('question_id, status')
        .eq('profile_id', supabaseConfig.profileId)
        .in('status', ['open', 'reviewing'])
    ]);
    if (unitsResult.error || attemptsResult.error || errorsResult.error) {
      throw unitsResult.error || attemptsResult.error || errorsResult.error;
    }

    const latest = latestAttemptsByQuestion(attemptsResult.data ?? []);
    const openErrors = new Set((errorsResult.data ?? []).map((row) => row.question_id).filter(Boolean));
    const studyByUnit = new Map((unitsResult.data ?? []).map((row) => [row.unit_id, row]));
    const now = new Date().toISOString();
    const updates = [];

    for (const unit of catalog.units ?? []) {
      const study = studyByUnit.get(unit.id);
      if (!study) continue;
      const questionIds = unit.questionIds ?? [];
      if (!questionIds.length) continue;
      const answered = questionIds.filter((id) => latest.has(id)).length;
      const correct = questionIds.filter((id) => latest.get(id)?.is_correct === true).length;
      const hasOpenError = questionIds.some((id) => openErrors.has(id));
      const mastery = Math.round((correct / questionIds.length) * 100);
      const completed = answered === questionIds.length && correct === questionIds.length && !hasOpenError;
      const desiredStatus = completed ? 'completed' : study.status === 'not_started' && answered === 0 ? 'not_started' : 'in_progress';
      const currentMastery = Number(study.mastery_percent ?? 0);
      const statusChanged = study.status !== desiredStatus;
      const masteryChanged = currentMastery !== mastery;
      const completedAtMismatch = completed ? !study.completed_at : Boolean(study.completed_at);
      if (!statusChanged && !masteryChanged && !completedAtMismatch) continue;

      updates.push(
        supabase
          .from('study_units')
          .update({
            status: desiredStatus,
            mastery_percent: mastery,
            completed_at: completed ? (study.completed_at ?? now) : null,
            last_activity_at: now
          })
          .eq('id', study.id)
          .eq('profile_id', supabaseConfig.profileId)
      );
    }

    if (updates.length) {
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    }
  } catch (error) {
    console.warn('Cycle progress sync: não foi possível sincronizar o estado das unidades.', error);
  } finally {
    syncing = false;
    if (rerun) {
      rerun = false;
      scheduleSync();
    }
  }
}

function scheduleSync() {
  clearTimeout(timer);
  timer = setTimeout(syncProgress, 180);
}

function start() {
  const content = document.querySelector('#pageContent');
  if (content) {
    new MutationObserver(scheduleSync).observe(content, { childList: true, subtree: true, characterData: true });
  }
  scheduleSync();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
