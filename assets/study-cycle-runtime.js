import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';
import { deriveStudyCycleProgress, isReviewDue, isSundayInBrasilia } from './study-cycle.js';

const pageId = document.body.dataset.page || 'home';
const CATALOG_URL = './content/catalog.json';
const CYCLE_URL = './content/study-cycle-v1.json';
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});

let publicPromise = null;
let renderQueued = false;
let renderBusy = false;

function loadPublicData() {
  if (!publicPromise) {
    publicPromise = Promise.all([
      fetch(CATALOG_URL, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('Catálogo indisponível.');
        return response.json();
      }),
      fetch(CYCLE_URL, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('Cronograma inicial indisponível.');
        return response.json();
      })
    ]).then(([catalog, plan]) => ({ catalog, plan }));
  }
  return publicPromise;
}

async function privateSnapshot() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) {
    return { authenticated: false, studyUnits: [], openErrorQuestionIds: [], reviewItems: [] };
  }
  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .select('id, is_active')
    .eq('id', supabaseConfig.profileId)
    .maybeSingle();
  if (profileError || profile?.is_active !== true) {
    return { authenticated: false, studyUnits: [], openErrorQuestionIds: [], reviewItems: [] };
  }

  const [studyResult, errorsResult, reviewsResult] = await Promise.all([
    supabase.from('study_units').select('unit_id, status, mastery_percent, last_activity_at').eq('profile_id', supabaseConfig.profileId),
    supabase.from('error_items').select('question_id, status').eq('profile_id', supabaseConfig.profileId).in('status', ['open', 'reviewing']),
    supabase.from('review_items').select('source_type, source_id, reason, status, repetitions, interval_days, next_review_at').eq('profile_id', supabaseConfig.profileId).in('status', ['scheduled', 'due']).order('next_review_at', { ascending: true })
  ]);
  if (studyResult.error || errorsResult.error || reviewsResult.error) {
    throw studyResult.error || errorsResult.error || reviewsResult.error;
  }
  return {
    authenticated: true,
    studyUnits: studyResult.data ?? [],
    openErrorQuestionIds: [...new Set((errorsResult.data ?? []).map((row) => row.question_id).filter(Boolean))],
    reviewItems: reviewsResult.data ?? []
  };
}

function injectStyle() {
  if (document.querySelector('link[data-study-cycle-v1]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './assets/study-cycle.css';
  link.dataset.studyCycleV1 = 'true';
  document.head.append(link);
}

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text != null) item.textContent = text;
  return item;
}

function simplifyAccessCopy() {
  if (pageId !== 'home') return;
  for (const paragraph of document.querySelectorAll('.auth-card p')) {
    if (paragraph.textContent?.includes('STU-MYCHAEL')) {
      paragraph.textContent = 'Sua sessão está ativa e o progresso pode ser salvo com privacidade.';
    }
  }
}

function unitMaps(catalog) {
  return {
    unitById: new Map((catalog.units ?? []).map((unit) => [unit.id, unit])),
    subjectById: new Map((catalog.subjects ?? []).map((subject) => [subject.id, subject])),
    questionById: new Map((catalog.questions ?? []).map((question) => [question.id, question]))
  };
}

async function renderHome() {
  if (pageId !== 'home') return;
  const hero = document.querySelector('.hero-card');
  const nextCopy = hero?.querySelector('.home-next-step');
  if (!hero || !nextCopy) return;
  simplifyAccessCopy();

  const [{ catalog, plan }, privateProgress] = await Promise.all([loadPublicData(), privateSnapshot()]);
  if (!privateProgress.authenticated) return;
  const { unitById, questionById } = unitMaps(catalog);
  const actions = hero.querySelector('.button-row');
  const primary = actions?.querySelector('a.primary-link');
  const secondary = [...(actions?.querySelectorAll('a') ?? [])].find((link) => link !== primary && link.getAttribute('href')?.includes('questoes.html'));

  if (isSundayInBrasilia()) {
    nextCopy.textContent = 'Hoje é domingo: dia de folga. O ciclo continua da mesma sessão no próximo dia de estudo.';
    if (primary) { primary.href = 'cronograma.html'; primary.textContent = 'Ver meu ciclo'; }
    if (secondary) secondary.hidden = true;
    return;
  }

  const errorQuestionId = privateProgress.openErrorQuestionIds[0];
  if (errorQuestionId) {
    const question = questionById.get(errorQuestionId);
    const unit = unitById.get(question?.unitId);
    if (unit) {
      nextCopy.textContent = `Corrigir antes de avançar: há erro pendente em ${unit.title}.`;
      if (primary) { primary.href = `questoes.html?unit=${encodeURIComponent(unit.id)}&mode=errors`; primary.textContent = 'Corrigir erro pendente'; }
      if (secondary) { secondary.href = `estudar.html?unit=${encodeURIComponent(unit.id)}`; secondary.textContent = 'Rever teoria'; secondary.hidden = false; }
      return;
    }
  }

  const dueReviews = privateProgress.reviewItems.filter((item) => isReviewDue(item));
  if (dueReviews.length) {
    nextCopy.textContent = `${dueReviews.length} revisão(ões) estão devidas e entram antes de conteúdo novo.`;
    if (primary) { primary.href = 'revisoes.html'; primary.textContent = 'Fazer revisões'; }
    if (secondary) secondary.hidden = true;
    return;
  }

  const progress = deriveStudyCycleProgress({
    plan,
    catalog,
    studyUnits: privateProgress.studyUnits,
    openErrorQuestionIds: privateProgress.openErrorQuestionIds
  });
  if (progress.checkpointDue) {
    nextCopy.textContent = 'Os quatro ciclos iniciais foram concluídos. Agora vem o checkpoint antes de abrir novos ciclos.';
    if (primary) { primary.href = 'desempenho.html'; primary.textContent = 'Ver meu progresso'; }
    if (secondary) secondary.hidden = true;
    return;
  }
  const currentUnit = unitById.get(progress.current?.unitId);
  if (!currentUnit) return;
  nextCopy.textContent = `Ciclo ${progress.current.cycleNumber} · sessão ${progress.current.positionInCycle} de 6: ${currentUnit.title}.`;
  if (primary) { primary.href = `estudar.html?unit=${encodeURIComponent(currentUnit.id)}`; primary.textContent = 'Continuar sessão'; }
  if (secondary) { secondary.href = `questoes.html?unit=${encodeURIComponent(currentUnit.id)}`; secondary.textContent = 'Questões desta unidade'; secondary.hidden = false; }
}

function staticSchedule(catalog, plan) {
  const { unitById, subjectById } = unitMaps(catalog);
  const wrap = node('div', 'cycle-page cycle-v1-page');
  const hero = node('section', 'cycle-v1-hero');
  hero.innerHTML = '<p class="status-pill">Adaptação inicial · 4 ciclos · 24 sessões</p><h2>Um passo por vez, com circulação de matérias.</h2><p>Uma matéria principal por sessão. Domingo é folga. Conteúdo novo só entra depois de erros e revisões devidas.</p>';
  wrap.append(hero);

  const current = node('section', 'card cycle-v1-current');
  current.id = 'cycleV1Current';
  current.innerHTML = '<p class="eyebrow">Seu ponto no ciclo</p><h2>Carregando progresso…</h2><p>O progresso é consultado de forma privada.</p>';
  wrap.append(current);

  const list = node('section', 'cycle-v1-grid');
  for (const cycle of plan.cycles ?? []) {
    const card = node('article', 'card cycle-v1-card');
    card.dataset.cycleNumber = String(cycle.number);
    const heading = node('div', 'section-heading');
    heading.append(node('p', 'eyebrow', `Ciclo ${cycle.number}`), node('h2', '', `Sessões ${(cycle.number - 1) * 6 + 1}–${cycle.number * 6}`));
    card.append(heading);
    const sessions = node('div', 'cycle-v1-sessions');
    for (const session of cycle.sessions ?? []) {
      const unit = unitById.get(session.unitId);
      if (!unit) continue;
      const subject = subjectById.get(unit.subjectId);
      const row = node('a', 'cycle-v1-session');
      row.href = `estudar.html?unit=${encodeURIComponent(unit.id)}`;
      row.dataset.unitId = unit.id;
      row.dataset.sessionNumber = String(session.number);
      const number = node('span', 'cycle-v1-number', String(session.number));
      const copy = node('span', 'cycle-v1-copy');
      copy.append(node('strong', '', subject?.name ?? unit.subjectId), node('span', '', unit.title.replace(/^.*?—\s*/, '')), node('small', '', `${unit.estimatedMinutes ?? '—'} min`));
      const status = node('span', 'cycle-v1-state', 'Planejada');
      row.append(number, copy, status);
      sessions.append(row);
    }
    card.append(sessions);
    list.append(card);
  }
  wrap.append(list);

  const rule = node('section', 'card cycle-v1-rules');
  rule.innerHTML = '<p class="eyebrow">Regras da primeira versão</p><h2>O ciclo acompanha o aprendizado, não o calendário</h2><div><p><strong>Domingo:</strong> folga, sem atraso.</p><p><strong>Unidade incompleta:</strong> retome antes de avançar.</p><p><strong>Após a sessão 24:</strong> checkpoint antes dos próximos ciclos.</p></div>';
  wrap.append(rule);

  const future = node('section', 'card cycle-v1-future');
  const planned = new Set((plan.cycles ?? []).flatMap((cycle) => cycle.sessions ?? []).map((session) => session.unitId));
  const reserve = (catalog.units ?? []).filter((unit) => !planned.has(unit.id)).length;
  future.innerHTML = `<p class="eyebrow">Próximos ciclos</p><h2>${reserve} unidade(s) publicadas ficam fora desta primeira versão</h2><p>Elas permanecem disponíveis no site, mas não serão inseridas no meio dos quatro ciclos. Novas matérias e unidades também entram somente nos ciclos futuros. A rotação específica continua condicionada ao O7.</p>`;
  wrap.append(future);
  return wrap;
}

async function renderSchedule() {
  if (pageId !== 'schedule') return;
  const target = document.querySelector('#pageContent');
  if (!target) return;
  const [{ catalog, plan }, privateProgress] = await Promise.all([loadPublicData(), privateSnapshot()]);
  if (!target.querySelector('.cycle-v1-page')) target.replaceChildren(staticSchedule(catalog, plan));

  const headerTitle = document.querySelector('.page-header h1');
  const headerDescription = document.querySelector('.page-header p:last-child');
  const eyebrow = document.querySelector('.page-header .eyebrow');
  const actions = document.querySelector('#pageActions');
  if (eyebrow) eyebrow.textContent = 'Plano de estudos';
  if (headerTitle) headerTitle.textContent = 'Cronograma por ciclos';
  if (headerDescription) headerDescription.textContent = 'Quatro ciclos iniciais, sem datas fixas e com uma matéria principal por sessão.';
  if (actions) actions.innerHTML = '<span class="status-pill">1 matéria por sessão · domingo livre</span>';

  if (!privateProgress.authenticated) {
    const status = target.querySelector('#cycleV1Current');
    if (status) status.innerHTML = '<p class="eyebrow">Seu ponto no ciclo</p><h2>Entre para acompanhar o progresso</h2><p>O cronograma público não contém dados pessoais.</p>';
    return;
  }
  const progress = deriveStudyCycleProgress({ plan, catalog, studyUnits: privateProgress.studyUnits, openErrorQuestionIds: privateProgress.openErrorQuestionIds });
  for (const row of target.querySelectorAll('.cycle-v1-session')) {
    const completed = progress.completedUnitIds.has(row.dataset.unitId);
    const current = progress.current?.unitId === row.dataset.unitId;
    row.classList.toggle('completed', completed);
    row.classList.toggle('current', current);
    const state = row.querySelector('.cycle-v1-state');
    if (state) state.textContent = completed ? 'Concluída' : current ? 'Agora' : 'Planejada';
  }
  const status = target.querySelector('#cycleV1Current');
  if (!status) return;
  if (isSundayInBrasilia()) {
    status.innerHTML = `<p class="eyebrow">Seu ponto no ciclo</p><h2>Domingo é folga</h2><p>${progress.current ? `A próxima sessão continua no Ciclo ${progress.current.cycleNumber}, sessão ${progress.current.positionInCycle} de 6.` : 'O checkpoint fica para o próximo dia de estudo.'}</p>`;
  } else if (progress.checkpointDue) {
    status.innerHTML = '<p class="eyebrow">Checkpoint</p><h2>24 de 24 sessões concluídas</h2><p>Os próximos ciclos só serão montados depois de revisar o progresso e o novo acervo publicado.</p>';
  } else {
    const currentUnit = (catalog.units ?? []).find((unit) => unit.id === progress.current?.unitId);
    status.innerHTML = `<p class="eyebrow">Seu ponto no ciclo</p><h2>Ciclo ${progress.current?.cycleNumber ?? 1} · sessão ${progress.current?.positionInCycle ?? 1} de 6</h2><p>${currentUnit?.title ?? 'Próxima unidade'} · ${progress.completedSessions}/24 sessões concluídas.</p>`;
  }
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

async function renderReviews() {
  if (pageId !== 'reviews') return;
  const target = document.querySelector('#pageContent');
  if (!target) return;
  const [{ catalog }, privateProgress] = await Promise.all([loadPublicData(), privateSnapshot()]);
  if (!privateProgress.authenticated) return;
  const { questionById, unitById } = unitMaps(catalog);
  const items = [...privateProgress.reviewItems].sort((a, b) => new Date(a.next_review_at ?? 0) - new Date(b.next_review_at ?? 0));
  const dueCount = items.filter((item) => isReviewDue(item)).length;
  const sunday = isSundayInBrasilia();
  const wrap = node('div', 'review-v1-page');
  const summary = node('section', 'card review-v1-summary');
  summary.innerHTML = `<p class="eyebrow">Fila de revisão</p><h2>${dueCount} revisão(ões) devida(s)</h2><p>${sunday && dueCount ? 'Hoje é domingo: elas ficam como prioridade para a próxima sessão de estudo.' : dueCount ? 'Faça as revisões devidas antes de abrir conteúdo novo.' : 'Nenhuma revisão está vencida agora.'}</p>`;
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
      copy.append(node('span', `status-pill ${due ? 'due' : 'scheduled'}`, due ? 'Revisão vencida' : reviewLabel(item.interval_days)), node('h2', '', unit?.title ?? question?.title ?? item.source_id));
      copy.append(node('p', '', due && sunday ? 'Prioridade para a próxima sessão de estudo.' : due ? 'Entre antes de conteúdo novo.' : reviewLabel(item.interval_days)));
      card.append(copy);
      if (question) {
        const action = node('a', 'primary-link', 'Revisar agora');
        action.href = `questoes.html?unit=${encodeURIComponent(question.unitId)}&mode=errors&question=${encodeURIComponent(question.id)}`;
        card.append(action);
      }
      list.append(card);
    }
    wrap.append(list);
  }
  target.replaceChildren(wrap);
}

async function refresh() {
  renderQueued = false;
  if (renderBusy) return;
  renderBusy = true;
  try {
    simplifyAccessCopy();
    await renderHome();
    await renderSchedule();
    await renderReviews();
  } catch (error) {
    console.warn('Study Cycle V1: não foi possível atualizar a experiência.', error);
  } finally {
    renderBusy = false;
  }
}

function queueRefresh() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(refresh);
}

function start() {
  injectStyle();
  const root = document.querySelector('#app');
  if (root) new MutationObserver(queueRefresh).observe(root, { childList: true, subtree: true });
  queueRefresh();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
