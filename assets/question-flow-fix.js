import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';
import { nextReviewAt, nextReviewInterval } from './review-schedule.js';

const pageId = document.body.dataset.page || '';
const CATALOG_URL = './content/catalog.json';
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

let catalogPromise = null;
let reviewAnsweredOnPage = false;
let saving = false;

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(CATALOG_URL, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error('Catálogo indisponível para validar a resposta.');
      return response.json();
    });
  }
  return catalogPromise;
}

function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function ensureActiveProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) throw sessionError ?? new Error('Sessão não autenticada.');
  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .select('id, status')
    .eq('id', supabaseConfig.profileId)
    .maybeSingle();
  if (profileError || profile?.status !== 'active') throw profileError ?? new Error('Perfil de estudo inativo.');
}

async function ensureUnitStarted(unitId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('study_units')
    .select('id, status, completed_at')
    .eq('profile_id', supabaseConfig.profileId)
    .eq('unit_id', unitId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: insertError } = await supabase.from('study_units').insert({
      profile_id: supabaseConfig.profileId,
      unit_id: unitId,
      status: 'in_progress',
      started_at: now,
      last_activity_at: now
    });
    if (insertError) throw insertError;
  }
}

async function loadOpenError(questionId) {
  const { data, error } = await supabase
    .from('error_items')
    .select('id, question_id, status')
    .eq('profile_id', supabaseConfig.profileId)
    .eq('question_id', questionId)
    .in('status', ['open', 'reviewing'])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function loadQuestionReview(questionId) {
  const { data, error } = await supabase
    .from('review_items')
    .select('id, status, repetitions, interval_days, last_reviewed_at, next_review_at')
    .eq('profile_id', supabaseConfig.profileId)
    .eq('source_type', 'question')
    .eq('source_id', questionId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

function reviewIsDue(review, now = Date.now()) {
  if (!review) return false;
  if (review.status === 'due') return true;
  const dueAt = new Date(review.next_review_at ?? '').getTime();
  return Number.isFinite(dueAt) && dueAt <= now;
}

async function openOrRefreshError(questionId, attemptId, currentError) {
  if (currentError) {
    const { error } = await supabase.from('error_items').update({
      attempt_id: attemptId,
      status: 'open',
      resolved_at: null
    }).eq('id', currentError.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('error_items').insert({
    profile_id: supabaseConfig.profileId,
    question_id: questionId,
    attempt_id: attemptId,
    error_type: 'interpretation',
    status: 'open'
  });
  if (error) throw error;
}

async function resolveOpenError(currentError) {
  if (!currentError) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from('error_items').update({
    status: 'resolved',
    resolved_at: now
  }).eq('id', currentError.id);
  if (error) throw error;
}

async function resetCorrectiveReview(questionId, review) {
  const { error } = await supabase.from('review_items').upsert({
    profile_id: supabaseConfig.profileId,
    source_type: 'question',
    source_id: questionId,
    reason: 'wrong_answer',
    status: 'scheduled',
    repetitions: review?.repetitions ?? 0,
    interval_days: 1,
    next_review_at: nextReviewAt(1)
  }, { onConflict: 'profile_id,source_type,source_id' });
  if (error) throw error;
}

async function advanceReview(questionId, review, { correctedError = false } = {}) {
  const now = new Date().toISOString();
  const intervalDays = correctedError ? 7 : nextReviewInterval(review?.interval_days ?? 1);
  const { error } = await supabase.from('review_items').upsert({
    profile_id: supabaseConfig.profileId,
    source_type: 'question',
    source_id: questionId,
    reason: correctedError ? 'spaced_review_after_correction' : 'spaced_review',
    status: 'scheduled',
    repetitions: (review?.repetitions ?? 0) + 1,
    interval_days: intervalDays,
    last_reviewed_at: now,
    next_review_at: nextReviewAt(intervalDays)
  }, { onConflict: 'profile_id,source_type,source_id' });
  if (error) throw error;
}

async function updateUnitProgress(unit) {
  const [attemptsResult, errorsResult, studyResult] = await Promise.all([
    supabase
      .from('question_attempts')
      .select('question_id, is_correct, answered_at')
      .eq('profile_id', supabaseConfig.profileId)
      .eq('unit_id', unit.id)
      .order('answered_at', { ascending: false }),
    supabase
      .from('error_items')
      .select('question_id, status')
      .eq('profile_id', supabaseConfig.profileId)
      .in('question_id', unit.questionIds ?? [])
      .in('status', ['open', 'reviewing']),
    supabase
      .from('study_units')
      .select('id, status, completed_at')
      .eq('profile_id', supabaseConfig.profileId)
      .eq('unit_id', unit.id)
      .maybeSingle()
  ]);
  if (attemptsResult.error || errorsResult.error || studyResult.error) {
    throw attemptsResult.error || errorsResult.error || studyResult.error;
  }

  const latest = new Map();
  for (const row of attemptsResult.data ?? []) if (!latest.has(row.question_id)) latest.set(row.question_id, row);
  const questionIds = unit.questionIds ?? [];
  const total = questionIds.length;
  const answered = questionIds.filter((id) => latest.has(id)).length;
  const correct = questionIds.filter((id) => latest.get(id)?.is_correct === true).length;
  const openErrors = new Set((errorsResult.data ?? []).map((row) => row.question_id));
  const completed = total > 0 && answered === total && correct === total && !questionIds.some((id) => openErrors.has(id));
  const mastery = total ? Math.round((correct / total) * 100) : 0;
  const study = studyResult.data;
  if (!study) throw new Error(`Progresso da unidade ${unit.id} não foi localizado.`);
  const now = new Date().toISOString();
  const { error } = await supabase.from('study_units').update({
    status: completed ? 'completed' : 'in_progress',
    mastery_percent: mastery,
    completed_at: completed ? (study.completed_at ?? now) : null,
    last_activity_at: now
  }).eq('id', study.id).eq('profile_id', supabaseConfig.profileId);
  if (error) throw error;
  return { completed, mastery, answered, correct, total };
}

async function saveAttempt(question, unit, answer, mode) {
  await ensureActiveProfile();
  await ensureUnitStarted(unit.id);
  const [errorBefore, reviewBefore, countResult] = await Promise.all([
    loadOpenError(question.id),
    loadQuestionReview(question.id),
    supabase
      .from('question_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', supabaseConfig.profileId)
      .eq('question_id', question.id)
  ]);
  if (countResult.error) throw countResult.error;

  const isCorrect = answer === question.answer;
  const { data: attempt, error } = await supabase.from('question_attempts').insert({
    profile_id: supabaseConfig.profileId,
    question_id: question.id,
    unit_id: unit.id,
    question_set_id: unit.questionSetIds?.[0] ?? null,
    answer,
    is_correct: isCorrect,
    attempt_number: (countResult.count ?? 0) + 1,
    client_event_id: crypto.randomUUID()
  }).select('id, question_id, answer, is_correct, attempt_number, answered_at').single();
  if (error) throw error;

  if (!isCorrect) {
    await openOrRefreshError(question.id, attempt.id, errorBefore);
    await resetCorrectiveReview(question.id, reviewBefore);
  } else if (errorBefore) {
    await resolveOpenError(errorBefore);
    await advanceReview(question.id, reviewBefore, { correctedError: true });
  } else if (mode === 'review' || reviewIsDue(reviewBefore)) {
    await advanceReview(question.id, reviewBefore);
  }

  const progress = await updateUnitProgress(unit);
  return { attempt, progress };
}

function renderFeedback(card, question, attempt) {
  card.querySelector('.feedback')?.remove();
  const box = document.createElement('div');
  box.className = `feedback ${attempt.is_correct ? 'correct' : 'incorrect'}`;
  const result = document.createElement('strong');
  result.textContent = attempt.is_correct ? 'Resposta correta.' : `Resposta incorreta. Gabarito: ${question.answer}.`;
  box.append(result);
  if (question.commentary) {
    const commentary = document.createElement('p');
    commentary.textContent = question.commentary;
    box.append(commentary);
  }
  if (question.foundation) {
    const foundation = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = 'Fundamento: ';
    foundation.append(strong, document.createTextNode(question.foundation));
    box.append(foundation);
  }
  card.append(box);
}

function returnToErrorsUrl(unitId) {
  const url = new URL('questoes.html', window.location.href);
  url.searchParams.set('mode', 'errors');
  if (unitId) url.searchParams.set('unit', unitId);
  return url;
}

function reloadCurrentQuestion(questionId) {
  const url = new URL(window.location.href);
  url.searchParams.set('question', questionId);
  window.location.href = url.toString();
}

async function interceptQuestionSubmit(event) {
  if (pageId !== 'questions') return;
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.classList.contains('question-form')) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (saving) return;

  const card = form.closest('.question-card');
  const questionId = card?.dataset.questionId;
  const answer = form.querySelector('input[type="radio"]:checked')?.value;
  if (!card || !questionId || !answer) return;

  const submit = form.querySelector('button[type="submit"]');
  const status = form.querySelector('.question-save-status');
  if (submit) { submit.disabled = true; submit.textContent = 'Salvando…'; }
  if (status) status.textContent = '';
  saving = true;
  try {
    const catalog = await loadCatalog();
    const question = (catalog.questions ?? []).find((item) => item.id === questionId);
    const unit = (catalog.units ?? []).find((item) => item.id === question?.unitId);
    if (!question || !unit) throw new Error('Questão ou unidade não localizada no catálogo publicado.');
    const mode = queryParam('mode') === 'review' ? 'review' : queryParam('mode') === 'errors' ? 'errors' : 'all';
    const { attempt } = await saveAttempt(question, unit, String(answer), mode);

    if (mode === 'errors' && attempt.is_correct) {
      window.location.href = returnToErrorsUrl(queryParam('unit') ? unit.id : null).toString();
      return;
    }
    if (mode === 'errors' || mode === 'review') {
      reviewAnsweredOnPage = mode === 'review';
      renderFeedback(card, question, attempt);
      if (status) status.textContent = attempt.is_correct
        ? mode === 'review' ? 'Revisão concluída e próxima etapa agendada.' : 'Correto. O erro foi resolvido e a próxima revisão foi agendada.'
        : 'Resposta salva. O erro permanece como prioridade e a revisão volta para o ciclo curto.';
      if (submit) { submit.disabled = false; submit.textContent = mode === 'review' ? 'Responder novamente' : 'Refazer questão'; }
      if (mode === 'review' && !card.querySelector('[data-review-back]')) {
        const link = document.createElement('a');
        link.className = 'secondary-link';
        link.href = 'revisoes.html';
        link.textContent = 'Voltar às revisões';
        link.dataset.reviewBack = 'true';
        card.append(link);
      }
      return;
    }
    reloadCurrentQuestion(question.id);
  } catch (error) {
    console.error('Fluxo de resposta corrigido:', error);
    if (status) status.textContent = 'Não foi possível salvar. Tente novamente.';
    if (submit) { submit.disabled = false; submit.textContent = queryParam('mode') === 'errors' ? 'Refazer questão' : 'Responder'; }
  } finally {
    saving = false;
  }
}

function prepareReviewQuestion() {
  if (pageId !== 'questions' || queryParam('mode') !== 'review' || reviewAnsweredOnPage) return;
  const targetQuestion = queryParam('question');
  const card = document.querySelector('.question-card');
  if (!card || (targetQuestion && card.dataset.questionId !== targetQuestion) || card.dataset.reviewPrepared === 'true') return;
  card.dataset.reviewPrepared = 'true';
  card.querySelector('.feedback')?.remove();
  for (const input of card.querySelectorAll('input[type="radio"]')) input.checked = false;
  const submit = card.querySelector('button[type="submit"]');
  if (submit) submit.textContent = 'Responder revisão';
  const palette = document.querySelector('.question-palette');
  if (palette) palette.hidden = true;
  const nav = card.querySelector('.question-nav');
  if (nav) nav.hidden = true;
  const tabs = document.querySelector('.filter-tabs');
  if (tabs) tabs.hidden = true;
  const heading = document.querySelector('.question-toolbar h2');
  if (heading) heading.textContent = 'Revisão programada';
}

function rewriteReviewActions() {
  if (pageId !== 'reviews') return;
  for (const action of document.querySelectorAll('.review-v1-item a.primary-link')) {
    let url;
    try { url = new URL(action.href, window.location.href); } catch { continue; }
    const questionId = url.searchParams.get('question');
    if (!questionId) continue;
    url.searchParams.set('mode', 'review');
    action.href = `${url.pathname.split('/').pop()}${url.search}`;
    action.textContent = 'Revisar agora';
  }
}

function applyUiFixes() {
  prepareReviewQuestion();
  rewriteReviewActions();
}

function start() {
  if (pageId === 'questions') document.addEventListener('submit', interceptQuestionSubmit, true);
  const root = document.querySelector('#app');
  if (root) new MutationObserver(applyUiFixes).observe(root, { childList: true, subtree: true });
  applyUiFixes();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
