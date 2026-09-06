import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';
import { REVIEW_INTERVALS, nextReviewAt, nextReviewInterval } from './review-schedule.js';
import { isReviewDue } from './study-cycle.js';
import { loadCatalog } from './content-loader.js';

const pageId = document.body.dataset.page || '';
const profileId = supabaseConfig.profileId;
const initialUnitReviewInterval = REVIEW_INTERVALS.find((interval) => interval > 1) ?? 7;
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

class UnitReviewStateError extends Error {}

function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function hasActiveProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) return false;
  const { data: profile, error } = await supabase
    .from('student_profiles')
    .select('id, is_active')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw error;
  return profile?.is_active === true;
}

async function reconcileCompletedUnitReviews(isCurrent = () => true) {
  if (!(await hasActiveProfile()) || !isCurrent()) return false;
  const [unitsResult, reviewsResult] = await Promise.all([
    supabase
      .from('study_units')
      .select('unit_id, status, completed_at')
      .eq('profile_id', profileId)
      .eq('status', 'completed'),
    supabase
      .from('review_items')
      .select('source_id')
      .eq('profile_id', profileId)
      .eq('source_type', 'unit')
  ]);
  if (unitsResult.error || reviewsResult.error) throw unitsResult.error || reviewsResult.error;
  if (!isCurrent()) return false;

  const existing = new Set((reviewsResult.data ?? []).map((item) => item.source_id));
  const missing = (unitsResult.data ?? []).filter((unit) => unit.unit_id && !existing.has(unit.unit_id));
  if (!missing.length) return true;

  const rows = missing.map((unit) => ({
    profile_id: profileId,
    source_type: 'unit',
    source_id: unit.unit_id,
    reason: 'unit_completed',
    status: 'scheduled',
    repetitions: 0,
    interval_days: initialUnitReviewInterval,
    next_review_at: nextReviewAt(initialUnitReviewInterval, unit.completed_at ? new Date(unit.completed_at) : new Date())
  }));
  const { error } = await supabase.from('review_items').upsert(rows, {
    onConflict: 'profile_id,source_type,source_id',
    ignoreDuplicates: true
  });
  if (error) throw error;
  return isCurrent();
}

async function loadUnitReview(unitId) {
  const { data, error } = await supabase
    .from('review_items')
    .select('id, source_id, reason, status, repetitions, interval_days, last_reviewed_at, next_review_at, updated_at')
    .eq('profile_id', profileId)
    .eq('source_type', 'unit')
    .eq('source_id', unitId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function openErrorsForUnit(unit) {
  const questionIds = unit?.questionIds ?? [];
  if (!questionIds.length) return [];
  const { data, error } = await supabase
    .from('error_items')
    .select('question_id, status')
    .eq('profile_id', profileId)
    .in('question_id', questionIds)
    .in('status', ['open', 'reviewing']);
  if (error) throw error;
  return data ?? [];
}

async function advanceUnitReview(review) {
  if (!isReviewDue(review)) {
    throw new UnitReviewStateError('Esta revisão não está devida. Confira o próximo prazo na fila de revisões.');
  }
  if (!review.updated_at) {
    throw new UnitReviewStateError('Atualize a página para carregar o estado atual desta revisão.');
  }
  const now = new Date();
  const intervalDays = nextReviewInterval(review.interval_days ?? initialUnitReviewInterval);
  const { data, error } = await supabase
    .from('review_items')
    .update({
      reason: 'spaced_unit_review',
      status: 'scheduled',
      repetitions: (review.repetitions ?? 0) + 1,
      interval_days: intervalDays,
      last_reviewed_at: now.toISOString(),
      next_review_at: nextReviewAt(intervalDays, now)
    })
    .eq('id', review.id)
    .eq('profile_id', profileId)
    .eq('updated_at', review.updated_at)
    .eq('repetitions', review.repetitions ?? 0)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new UnitReviewStateError('A revisão mudou ou não está mais disponível. Confira a fila de revisões antes de continuar.');
  }
}

async function completeUnitReview(unit, isCurrent) {
  if (!(await hasActiveProfile()) || !isCurrent()) {
    throw new UnitReviewStateError('A sessão mudou. Entre novamente antes de concluir a revisão.');
  }
  const current = await loadUnitReview(unit.id);
  if (!current) throw new UnitReviewStateError('Revisão da unidade não localizada. Confira a fila de revisões.');
  const errors = await openErrorsForUnit(unit);
  if (errors.length) throw new UnitReviewStateError('Há erro aberto nesta unidade. Corrija a questão antes de concluir a revisão.');
  if (!isCurrent()) throw new UnitReviewStateError('A sessão mudou. Entre novamente antes de concluir a revisão.');
  await advanceUnitReview(current);
}

function reviewCardTemplate(unit, blocked, review) {
  const section = document.createElement('section');
  section.className = 'card unit-review-card';
  section.dataset.unitReviewPanel = 'true';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'Revisão espaçada';
  const title = document.createElement('h2');
  title.textContent = `Revisar ${unit.title.replace(/^.*?—\s*/, '')}`;
  const copy = document.createElement('p');
  copy.textContent = blocked
    ? 'Há erro aberto nesta unidade. Corrija o erro antes de concluir esta revisão.'
    : 'Releia os pontos principais e, quando terminar, registre a revisão para agendar a próxima etapa.';
  if (!blocked && !isReviewDue(review)) {
    copy.textContent = review.status === 'paused' ? 'Esta revisão está pausada.'
      : review.status === 'completed' ? 'Esta revisão já foi concluída.'
        : 'A próxima revisão já está agendada. Você pode reler o material sem alterar o prazo.';
  }
  section.append(eyebrow, title, copy);
  const nextDate = new Date(review.next_review_at ?? '');
  if (review.status === 'scheduled' && Number.isFinite(nextDate.getTime())) {
    const date = document.createElement('p');
    date.textContent = `Próxima revisão: ${new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo'
    }).format(nextDate)}`;
    section.append(date);
  }
  return section;
}

export async function renderStudyReview(target, isCurrent) {
  if (pageId !== 'study' || queryParam('mode') !== 'review' || !isCurrent()) return;
  const unitId = queryParam('unit');
  if (!unitId) return;
  if (!target || !target.children.length || target.querySelector('[data-unit-review-panel]')) return;
  if (!(await reconcileCompletedUnitReviews(isCurrent))) return;

  const catalog = await loadCatalog();
  const unit = (catalog.units ?? []).find((item) => item.id === unitId);
  if (!unit || !isCurrent()) return;
  const [review, errors] = await Promise.all([loadUnitReview(unitId), openErrorsForUnit(unit)]);
  if (!review || !isCurrent()) return;

  const blocked = errors.length > 0;
  const panel = reviewCardTemplate(unit, blocked, review);
  if (blocked) {
    const link = document.createElement('a');
    link.className = 'primary-link';
    link.href = `questoes.html?unit=${encodeURIComponent(unit.id)}&mode=errors`;
    link.textContent = 'Corrigir erro primeiro';
    panel.append(link);
  } else if (isReviewDue(review)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'primary-button';
    button.textContent = 'Concluir revisão';
    const status = document.createElement('p');
    status.className = 'inline-status';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Salvando…';
      status.textContent = '';
      try {
        await completeUnitReview(unit, isCurrent);
        if (isCurrent()) window.location.href = 'revisoes.html';
      } catch (error) {
        console.error('Revisão de unidade:', error);
        status.textContent = error instanceof UnitReviewStateError ? error.message
          : 'Não foi possível confirmar a revisão. Tente novamente ou confira a fila de revisões.';
        button.disabled = error instanceof UnitReviewStateError;
        button.textContent = button.disabled ? 'Confira a fila de revisões' : 'Tentar novamente';
      }
    });
    panel.append(button, status);
  }
  const back = document.createElement('a');
  back.className = 'secondary-link';
  back.href = 'revisoes.html';
  back.textContent = 'Voltar às revisões';
  panel.append(back);
  target.prepend(panel);
}

if (pageId === 'questions') {
  const start = () => reconcileCompletedUnitReviews().catch((error) => {
    console.error('Reconciliação de revisão por unidade:', error);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else void start();
}
