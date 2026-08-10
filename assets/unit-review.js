import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';
import { REVIEW_INTERVALS, nextReviewAt, nextReviewInterval } from './review-schedule.js';

const pageId = document.body.dataset.page || '';
const profileId = supabaseConfig.profileId;
const catalogUrl = './content/catalog.json';
const initialUnitReviewInterval = REVIEW_INTERVALS.find((interval) => interval > 1) ?? 7;
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

let catalogPromise = null;
let profilePromise = null;
let reconciling = null;
let uiRefreshBusy = false;
let uiObserver = null;

function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(catalogUrl, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('Catálogo indisponível para revisão.');
      return response.json();
    });
  }
  return catalogPromise;
}

async function hasActiveProfile() {
  if (!profilePromise) {
    profilePromise = (async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.user) return false;
      const { data: profile, error } = await supabase
        .from('student_profiles')
        .select('id, is_active')
        .eq('id', profileId)
        .maybeSingle();
      if (error) throw error;
      return profile?.is_active === true;
    })();
  }
  return profilePromise;
}

async function reconcileCompletedUnitReviews() {
  if (reconciling) return reconciling;
  reconciling = (async () => {
    if (!(await hasActiveProfile())) return;
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

    const existing = new Set((reviewsResult.data ?? []).map((item) => item.source_id));
    const missing = (unitsResult.data ?? []).filter((unit) => unit.unit_id && !existing.has(unit.unit_id));
    if (!missing.length) return;

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
  })().finally(() => { reconciling = null; });
  return reconciling;
}

async function loadUnitReview(unitId) {
  const { data, error } = await supabase
    .from('review_items')
    .select('id, source_id, reason, status, repetitions, interval_days, last_reviewed_at, next_review_at')
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
  const now = new Date();
  const intervalDays = nextReviewInterval(review.interval_days ?? initialUnitReviewInterval);
  const { error } = await supabase
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
    .eq('profile_id', profileId);
  if (error) throw error;
}

function findUnitReviewCard(unitTitle) {
  return [...document.querySelectorAll('.review-v1-item')].find((card) => card.querySelector('h2')?.textContent === unitTitle) ?? null;
}

async function augmentReviewCards() {
  if (pageId !== 'reviews' || !(await hasActiveProfile())) return;
  const [catalog, reviewsResult] = await Promise.all([
    loadCatalog(),
    supabase
      .from('review_items')
      .select('source_id, status, next_review_at')
      .eq('profile_id', profileId)
      .eq('source_type', 'unit')
      .in('status', ['scheduled', 'due'])
  ]);
  if (reviewsResult.error) throw reviewsResult.error;
  const unitById = new Map((catalog.units ?? []).map((unit) => [unit.id, unit]));
  for (const review of reviewsResult.data ?? []) {
    const unit = unitById.get(review.source_id);
    if (!unit) continue;
    const card = findUnitReviewCard(unit.title);
    if (!card || card.querySelector('[data-unit-review-action]')) continue;
    const action = document.createElement('a');
    action.className = 'primary-link';
    action.href = `estudar.html?unit=${encodeURIComponent(unit.id)}&mode=review`;
    action.textContent = 'Revisar unidade';
    action.dataset.unitReviewAction = 'true';
    card.append(action);
  }
}

function reviewCardTemplate(unit, blocked) {
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
  section.append(eyebrow, title, copy);
  return section;
}

async function renderStudyReview() {
  if (pageId !== 'study' || queryParam('mode') !== 'review' || !(await hasActiveProfile())) return;
  const unitId = queryParam('unit');
  if (!unitId) return;
  const target = document.querySelector('#pageContent');
  if (!target || !target.children.length || target.querySelector('[data-unit-review-panel]')) return;

  const catalog = await loadCatalog();
  const unit = (catalog.units ?? []).find((item) => item.id === unitId);
  if (!unit) return;
  const [review, errors] = await Promise.all([loadUnitReview(unitId), openErrorsForUnit(unit)]);
  if (!review) return;

  const blocked = errors.length > 0;
  const panel = reviewCardTemplate(unit, blocked);
  if (blocked) {
    const link = document.createElement('a');
    link.className = 'primary-link';
    link.href = `questoes.html?unit=${encodeURIComponent(unit.id)}&mode=errors`;
    link.textContent = 'Corrigir erro primeiro';
    panel.append(link);
  } else {
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
        const current = await loadUnitReview(unit.id);
        if (!current) throw new Error('Revisão da unidade não localizada.');
        const currentErrors = await openErrorsForUnit(unit);
        if (currentErrors.length) throw new Error('Existe erro aberto nesta unidade.');
        await advanceUnitReview(current);
        window.location.href = 'revisoes.html';
      } catch (error) {
        console.error('Revisão de unidade:', error);
        status.textContent = 'Não foi possível concluir a revisão. Corrija pendências e tente novamente.';
        button.disabled = false;
        button.textContent = 'Concluir revisão';
      }
    });
    panel.append(button, status);
  }
  target.prepend(panel);
}

function uiReady() {
  if (pageId === 'reviews') return Boolean(document.querySelector('.review-v1-page, .review-list, .empty-card'));
  if (pageId === 'study') return Boolean(document.querySelector('#pageContent')?.children.length);
  return true;
}

async function scheduleUiRefresh() {
  if (uiRefreshBusy) return;
  uiRefreshBusy = true;
  try {
    if (pageId === 'reviews') await augmentReviewCards();
    if (pageId === 'study') await renderStudyReview();
  } catch (error) {
    console.error('Revisão de unidade:', error);
  } finally {
    uiRefreshBusy = false;
    if (uiReady()) {
      uiObserver?.disconnect();
      uiObserver = null;
    }
  }
}

async function start() {
  try {
    await reconcileCompletedUnitReviews();
  } catch (error) {
    console.error('Reconciliação de revisão por unidade:', error);
  }
  const root = document.querySelector('#app');
  if (root && (pageId === 'reviews' || pageId === 'study')) {
    uiObserver = new MutationObserver(() => { void scheduleUiRefresh(); });
    uiObserver.observe(root, { childList: true, subtree: true });
  }
  await scheduleUiRefresh();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
