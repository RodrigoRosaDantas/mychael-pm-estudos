import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supabaseConfig } from './supabase-config.js';

const catalogUrl = './content/catalog.json';
const reviewWorkspace = document.querySelector('#reviewWorkspace');
const errorWorkspace = document.querySelector('#errorWorkspace');
const performanceWorkspace = document.querySelector('#performanceWorkspace');
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

let catalog = { questions: [] };
let refreshTimer = null;

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = options.text;
  return node;
}

function questionById(questionId) {
  return catalog.questions?.find(({ id }) => id === questionId) ?? null;
}

function formatDate(value) {
  if (!value) return 'Data não definida';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date(value));
}

function setPrivateState(target, message) {
  target.className = 'private-panel empty-state';
  target.textContent = message;
}

function openQuestion(questionId) {
  const escapedId = window.CSS?.escape ? CSS.escape(questionId) : questionId.replace(/[^a-zA-Z0-9_-]/g, '');
  const card = document.querySelector(`[data-question-id="${escapedId}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('review-target');
  window.setTimeout(() => card.classList.remove('review-target'), 1_800);
}

function actionButton(questionId, text = 'Abrir questão') {
  const button = element('button', { className: 'secondary-button compact-button', text });
  button.type = 'button';
  button.addEventListener('click', () => openQuestion(questionId));
  return button;
}

function renderReviews(rows) {
  const active = rows.filter(({ status }) => status !== 'completed');
  if (active.length === 0) {
    setPrivateState(reviewWorkspace, 'Nenhuma revisão pendente. Continue estudando com calma.');
    return;
  }

  const list = element('div', { className: 'private-list' });
  const now = Date.now();
  for (const review of active) {
    const question = questionById(review.source_id);
    const due = new Date(review.next_review_at).getTime() <= now;
    const item = element('article', { className: 'private-item' });
    const header = element('div', { className: 'private-item-header' });
    const heading = element('div');
    heading.append(
      element('p', { className: 'eyebrow dark', text: review.source_id }),
      element('h3', { text: question?.statement ?? 'Questão para revisão' })
    );
    header.append(
      heading,
      element('span', {
        className: `panel-badge ${due ? 'due' : 'scheduled'}`,
        text: due ? 'Revisar agora' : `Agendada: ${formatDate(review.next_review_at)}`
      })
    );
    const reason = element('p', { text: review.reason ?? 'Revisão programada conforme o histórico.' });
    item.append(header, reason, actionButton(review.source_id, due ? 'Fazer revisão' : 'Abrir questão'));
    list.append(item);
  }

  reviewWorkspace.className = 'private-panel';
  reviewWorkspace.replaceChildren(list);
}

function renderErrors(rows) {
  const openByQuestion = new Map();
  for (const item of rows) {
    if (!['open', 'reviewing'].includes(item.status)) continue;
    if (!openByQuestion.has(item.question_id)) openByQuestion.set(item.question_id, item);
  }

  if (openByQuestion.size === 0) {
    setPrivateState(errorWorkspace, 'Nenhum erro aberto. Os itens resolvidos permanecem preservados no histórico.');
    return;
  }

  const list = element('div', { className: 'private-list' });
  for (const item of openByQuestion.values()) {
    const question = questionById(item.question_id);
    const card = element('article', { className: 'private-item error-item' });
    card.append(
      element('p', { className: 'eyebrow dark', text: item.question_id }),
      element('h3', { text: question?.statement ?? 'Questão registrada no caderno de erros' }),
      element('p', { text: `Tipo identificado: ${item.error_type}. Registrado em ${formatDate(item.created_at)}.` }),
      actionButton(item.question_id, 'Revisar este erro')
    );
    list.append(card);
  }

  errorWorkspace.className = 'private-panel';
  errorWorkspace.replaceChildren(list);
}

function renderPerformance({ attempts, units, errors, reviews }) {
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter(({ is_correct }) => is_correct).length;
  const accuracy = totalAttempts ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const completedUnits = units.filter(({ status }) => status === 'completed').length;
  const openErrors = new Set(
    errors.filter(({ status }) => ['open', 'reviewing'].includes(status)).map(({ question_id }) => question_id)
  ).size;
  const pendingReviews = reviews.filter(({ status }) => status !== 'completed').length;

  const grid = element('div', { className: 'performance-grid' });
  for (const [value, label] of [
    [totalAttempts, 'tentativas'],
    [`${accuracy}%`, 'aproveitamento'],
    [completedUnits, 'unidades concluídas'],
    [openErrors, 'erros abertos'],
    [pendingReviews, 'revisões pendentes']
  ]) {
    const stat = element('article', { className: 'performance-stat' });
    stat.append(element('strong', { text: String(value) }), element('span', { text: label }));
    grid.append(stat);
  }

  performanceWorkspace.className = 'private-panel';
  performanceWorkspace.replaceChildren(grid);
}

async function loadCatalog() {
  try {
    const response = await fetch(`${catalogUrl}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    catalog = await response.json();
  } catch (error) {
    console.error('Falha ao carregar catálogo para os painéis privados:', error);
  }
}

async function fetchPrivateData() {
  const [reviews, errors, attempts, units] = await Promise.all([
    supabase
      .from('review_items')
      .select('id, source_type, source_id, reason, status, repetitions, interval_days, next_review_at, last_reviewed_at')
      .eq('profile_id', supabaseConfig.profileId)
      .order('next_review_at', { ascending: true }),
    supabase
      .from('error_items')
      .select('id, question_id, error_type, status, created_at, resolved_at')
      .eq('profile_id', supabaseConfig.profileId)
      .order('created_at', { ascending: false }),
    supabase
      .from('question_attempts')
      .select('question_id, is_correct, attempt_number, answered_at')
      .eq('profile_id', supabaseConfig.profileId)
      .order('answered_at', { ascending: false }),
    supabase
      .from('study_units')
      .select('unit_id, status, mastery_percent, completed_at, last_activity_at')
      .eq('profile_id', supabaseConfig.profileId)
      .order('last_activity_at', { ascending: false })
  ]);

  for (const result of [reviews, errors, attempts, units]) {
    if (result.error) throw result.error;
  }

  return {
    reviews: reviews.data ?? [],
    errors: errors.data ?? [],
    attempts: attempts.data ?? [],
    units: units.data ?? []
  };
}

async function loadPrivatePanels() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    setPrivateState(reviewWorkspace, 'Entre para consultar as revisões.');
    setPrivateState(errorWorkspace, 'Entre para consultar o caderno de erros.');
    setPrivateState(performanceWorkspace, 'Entre para consultar o desempenho.');
    return;
  }

  try {
    const data = await fetchPrivateData();
    renderReviews(data.reviews);
    renderErrors(data.errors);
    renderPerformance(data);
  } catch (error) {
    console.error('Falha ao carregar painéis privados:', error);
    setPrivateState(reviewWorkspace, 'Não foi possível carregar as revisões agora.');
    setPrivateState(errorWorkspace, 'Não foi possível carregar o caderno de erros agora.');
    setPrivateState(performanceWorkspace, 'Não foi possível carregar o desempenho agora.');
  }
}

async function latestAttempt(questionId) {
  const { data, error } = await supabase
    .from('question_attempts')
    .select('question_id, is_correct, attempt_number, answered_at')
    .eq('profile_id', supabaseConfig.profileId)
    .eq('question_id', questionId)
    .order('answered_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureReview(questionId, answeredAt) {
  const nextReviewAt = new Date(new Date(answeredAt).getTime() + 86_400_000).toISOString();
  const payload = {
    profile_id: supabaseConfig.profileId,
    source_type: 'question',
    source_id: questionId,
    reason: 'Revisão automática de questão respondida incorretamente',
    status: 'scheduled',
    interval_days: 1,
    next_review_at: nextReviewAt
  };
  const { error } = await supabase
    .from('review_items')
    .upsert(payload, { onConflict: 'profile_id,source_type,source_id' });
  if (error) throw error;
}

async function resolveErrors(questionId) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('error_items')
    .update({ status: 'resolved', resolved_at: now })
    .eq('profile_id', supabaseConfig.profileId)
    .eq('question_id', questionId)
    .in('status', ['open', 'reviewing']);
  if (error) throw error;
}

async function completeDueReview(questionId) {
  const { data, error } = await supabase
    .from('review_items')
    .select('id, status, repetitions, next_review_at')
    .eq('profile_id', supabaseConfig.profileId)
    .eq('source_type', 'question')
    .eq('source_id', questionId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.status === 'completed') return;
  if (new Date(data.next_review_at).getTime() > Date.now()) return;

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('review_items')
    .update({
      status: 'completed',
      repetitions: (data.repetitions ?? 0) + 1,
      last_reviewed_at: now
    })
    .eq('id', data.id);
  if (updateError) throw updateError;
}

async function reconcileQuestion(questionId) {
  const attempt = await latestAttempt(questionId);
  if (!attempt) return;
  if (attempt.is_correct) {
    await Promise.all([resolveErrors(questionId), completeDueReview(questionId)]);
  } else {
    await ensureReview(questionId, attempt.answered_at);
  }
}

function scheduleRefresh(questionId) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(async () => {
    try {
      await reconcileQuestion(questionId);
      await loadPrivatePanels();
    } catch (error) {
      console.error('Falha ao atualizar revisão e caderno de erros:', error);
    }
  }, 2_000);
}

document.addEventListener('submit', (event) => {
  const form = event.target.closest?.('.question-form');
  const questionId = form?.closest('[data-question-id]')?.dataset.questionId;
  if (questionId) scheduleRefresh(questionId);
}, true);

supabase.auth.onAuthStateChange(() => {
  window.setTimeout(loadPrivatePanels, 0);
});

await loadCatalog();
await loadPrivatePanels();
