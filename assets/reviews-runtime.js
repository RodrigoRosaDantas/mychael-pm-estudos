import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';
import { isReviewDue } from './study-cycle.js';
import { REVIEW_INTERVALS, nextReviewAt } from './review-schedule.js';

const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
const profileId = supabaseConfig.profileId;
const initialUnitReviewInterval = REVIEW_INTERVALS.find((interval) => interval > 1) ?? 7;

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null) item.textContent = text;
  return item;
}

function reviewLabel(intervalDays) {
  if (intervalDays === 1) return 'Revisão de correção';
  if (intervalDays === 7) return 'Revisão semanal';
  if (intervalDays === 14 || intervalDays === 15) return 'Revisão quinzenal';
  if (intervalDays === 30) return 'Revisão mensal';
  if (intervalDays === 60) return 'Revisão bimestral';
  if (intervalDays === 90) return 'Revisão trimestral';
  if (intervalDays === 180) return 'Revisão semestral';
  return 'Revisão programada';
}

function waitForBaseRender() {
  return new Promise((resolve) => {
    const ready = () => {
      const target = document.querySelector('#pageContent');
      const status = document.querySelector('#pageStatus')?.textContent?.trim();
      if (target && target.children.length && status !== 'Carregando…') {
        resolve(target);
        return true;
      }
      return false;
    };
    if (ready()) return;
    const observer = new MutationObserver(() => {
      if (ready()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
}

async function activeProfile() {
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

async function reconcileCompletedUnitReviews() {
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
  const rows = (unitsResult.data ?? [])
    .filter((unit) => unit.unit_id && !existing.has(unit.unit_id))
    .map((unit) => ({
      profile_id: profileId,
      source_type: 'unit',
      source_id: unit.unit_id,
      reason: 'unit_completed',
      status: 'scheduled',
      repetitions: 0,
      interval_days: initialUnitReviewInterval,
      next_review_at: nextReviewAt(initialUnitReviewInterval, unit.completed_at ? new Date(unit.completed_at) : new Date())
    }));
  if (!rows.length) return;
  const { error } = await supabase.from('review_items').upsert(rows, {
    onConflict: 'profile_id,source_type,source_id',
    ignoreDuplicates: true
  });
  if (error) throw error;
}

async function loadData() {
  const [catalogResponse, reviewsResult] = await Promise.all([
    fetch('./content/catalog.json', { cache: 'no-store' }),
    supabase
      .from('review_items')
      .select('id, source_type, source_id, reason, status, repetitions, interval_days, next_review_at')
      .eq('profile_id', profileId)
      .in('status', ['scheduled', 'due'])
      .order('next_review_at', { ascending: true })
  ]);
  if (!catalogResponse.ok) throw new Error('Catálogo indisponível.');
  if (reviewsResult.error) throw reviewsResult.error;
  return { catalog: await catalogResponse.json(), reviews: reviewsResult.data ?? [] };
}

function render(target, catalog, reviews) {
  const questionById = new Map((catalog.questions ?? []).map((question) => [question.id, question]));
  const unitById = new Map((catalog.units ?? []).map((unit) => [unit.id, unit]));
  const items = [...reviews].sort((a, b) => new Date(a.next_review_at ?? 0) - new Date(b.next_review_at ?? 0));
  const dueCount = items.filter((item) => isReviewDue(item)).length;

  const wrap = node('div', 'review-v1-page');
  const summary = node('section', 'card review-v1-summary');
  summary.append(
    node('p', 'eyebrow', 'Fila de revisão'),
    node('h2', '', `${dueCount} revisão(ões) devida(s)`),
    node('p', '', dueCount ? 'Faça as revisões devidas antes de abrir conteúdo novo.' : 'Nenhuma revisão está vencida agora.')
  );
  wrap.append(summary);

  if (!items.length) {
    const empty = node('section', 'card empty-card');
    empty.append(node('h2', '', 'Nenhuma revisão pendente'), node('p', '', 'As próximas revisões aparecerão aqui conforme o estudo avançar.'));
    wrap.append(empty);
  } else {
    const list = node('section', 'review-v1-list');
    for (const item of items) {
      const due = isReviewDue(item);
      const question = item.source_type === 'question' ? questionById.get(item.source_id) : null;
      const unit = unitById.get(question?.unitId ?? item.source_id);
      const card = node('article', `card review-v1-item ${due ? 'due' : ''}`);
      const copy = node('div', 'review-v1-copy');
      copy.append(
        node('span', `status-pill ${due ? 'due' : 'scheduled'}`, due ? 'Revisão vencida' : reviewLabel(item.interval_days)),
        node('h2', '', unit?.title ?? question?.title ?? item.source_id),
        node('p', '', due ? 'Entre antes de conteúdo novo.' : reviewLabel(item.interval_days))
      );
      card.append(copy);

      if (question) {
        const action = node('a', 'primary-link', 'Revisar agora');
        action.href = `questoes.html?unit=${encodeURIComponent(question.unitId)}&mode=review&question=${encodeURIComponent(question.id)}`;
        card.append(action);
      } else if (unit) {
        const action = node('a', 'primary-link', 'Revisar unidade');
        action.href = `estudar.html?unit=${encodeURIComponent(unit.id)}&mode=review`;
        action.dataset.unitReviewAction = 'true';
        card.append(action);
      }
      list.append(card);
    }
    wrap.append(list);
  }

  target.replaceChildren(wrap);
}

async function start() {
  const target = await waitForBaseRender();
  try {
    if (!(await activeProfile())) return;
    await reconcileCompletedUnitReviews();
    const { catalog, reviews } = await loadData();
    render(target, catalog, reviews);
  } catch (error) {
    console.error('Revisões:', error);
    if (!target.children.length) {
      const card = node('section', 'card empty-card');
      card.append(node('h2', '', 'Não foi possível carregar as revisões'), node('p', '', 'Atualize a página e tente novamente.'));
      target.append(card);
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else void start();
