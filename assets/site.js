import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';

const catalogUrl = './content/catalog.json';
const pageId = document.body.dataset.page || 'home';
const questionTimers = new Map();
let catalog = null;
let session = null;
let profileActive = false;

const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

const NAV_ITEMS = [
  ['home', 'Início', 'index.html', '⌂'],
  ['study', 'Estudo de hoje', 'estudar.html', '▤'],
  ['subjects', 'Matérias', 'materias.html', '▦'],
  ['questions', 'Questões', 'questoes.html', '?'],
  ['reviews', 'Revisões', 'revisoes.html', '↻'],
  ['errors', 'Caderno de erros', 'erros.html', '!'],
  ['exams', 'Provas anteriores', 'provas.html', '▧'],
  ['simulations', 'Simulados', 'simulados.html', '◷'],
  ['taf', 'TAF', 'taf.html', '✓'],
  ['performance', 'Desempenho', 'desempenho.html', '◫'],
  ['settings', 'Configurações', 'configuracoes.html', '⚙']
];

const PAGE_TITLES = {
  home: ['Início', 'Visão geral do estudo e próximo passo.'],
  study: ['Estudo de hoje', 'Leia a unidade com calma antes de praticar.'],
  subjects: ['Matérias', 'Conteúdos publicados e unidades disponíveis.'],
  questions: ['Questões', 'Pratique, confira a correção e consolide o conteúdo.'],
  reviews: ['Revisões', 'Retome o que precisa ser lembrado no momento certo.'],
  errors: ['Caderno de erros', 'Revise e refaça somente as questões que ainda precisam de atenção.'],
  exams: ['Provas anteriores', 'Acervo histórico autêntico, separado dos simulados.'],
  simulations: ['Simulados', 'Treinos completos serão liberados após a base mínima.'],
  taf: ['TAF', 'Orientação e acompanhamento sem confundir treino com índice oficial.'],
  performance: ['Desempenho', 'Resumo privado do progresso sincronizado.'],
  settings: ['Configurações', 'Acesso e informações técnicas essenciais.']
};

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = options.text;
  if (options.id) node.id = options.id;
  if (options.href) node.href = options.href;
  return node;
}

function setStatus(message, tone = '') {
  const target = document.querySelector('#pageStatus');
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
}

function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function findById(collection, id) {
  return collection?.find((item) => item.id === id) ?? null;
}

function firstUnit() {
  return [...(catalog?.units ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0] ?? null;
}

function requestedUnit() {
  const id = queryParam('unit');
  return id ? findById(catalog?.units, id) : null;
}

function currentUnit() {
  return requestedUnit() ?? firstUnit();
}

function unitForQuestion(question) {
  return findById(catalog?.units, question?.unitId) ?? null;
}

function pageUrl(page, params = {}) {
  const item = NAV_ITEMS.find(([id]) => id === page);
  const url = new URL(item?.[2] ?? 'index.html', window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') url.searchParams.set(key, value);
  }
  return `${url.pathname.split('/').pop()}${url.search}`;
}

function buildShell() {
  const root = document.querySelector('#app');
  const [title, description] = PAGE_TITLES[pageId] ?? PAGE_TITLES.home;
  root.innerHTML = `
    <a class="skip-link" href="#mainContent">Pular para o conteúdo</a>
    <header class="mobile-header">
      <a class="mobile-brand" href="index.html" aria-label="Mychael PM — Início">
        <span class="brand-mark">MP</span><span>Mychael PM</span>
      </a>
      <button id="menuButton" class="menu-button" type="button" aria-expanded="false" aria-controls="sidebar">Menu</button>
    </header>
    <div id="sidebarBackdrop" class="sidebar-backdrop" hidden></div>
    <div class="app-shell">
      <aside id="sidebar" class="sidebar" aria-label="Navegação principal">
        <a class="brand" href="index.html"><span class="brand-mark">MP</span><span><strong>Mychael PM</strong><small>PMGO e PMDF</small></span></a>
        <nav id="mainNav" class="main-nav"></nav>
        <div class="sidebar-footer">
          <span id="sessionIndicator" class="session-indicator">Verificando acesso…</span>
          <button id="sidebarLogout" class="text-button" type="button" hidden>Sair</button>
        </div>
      </aside>
      <main id="mainContent" class="page" tabindex="-1">
        <header class="page-header">
          <div><p class="eyebrow">Plataforma guiada</p><h1>${title}</h1><p>${description}</p></div>
          <div id="pageActions" class="page-actions"></div>
        </header>
        <p id="pageStatus" class="page-status" role="status" aria-live="polite"></p>
        <div id="pageContent" class="page-content"></div>
      </main>
    </div>`;

  const nav = document.querySelector('#mainNav');
  for (const [id, label, href, icon] of NAV_ITEMS) {
    const link = el('a', { href, className: id === pageId ? 'active' : '' });
    if (id === pageId) link.setAttribute('aria-current', 'page');
    link.append(el('span', { className: 'nav-icon', text: icon }), el('span', { text: label }));
    nav.append(link);
  }

  const menuButton = document.querySelector('#menuButton');
  const sidebar = document.querySelector('#sidebar');
  const backdrop = document.querySelector('#sidebarBackdrop');
  const setOpen = (open) => {
    sidebar.classList.toggle('open', open);
    backdrop.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
  };
  menuButton.addEventListener('click', () => setOpen(!sidebar.classList.contains('open')));
  backdrop.addEventListener('click', () => setOpen(false));
  nav.addEventListener('click', () => setOpen(false));
}

async function loadCatalog() {
  const response = await fetch(catalogUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao carregar o catálogo (${response.status}).`);
  const data = await response.json();
  if (data.publicationStatus !== 'published') throw new Error('O catálogo público ainda não está liberado.');
  catalog = data;
  return data;
}

async function refreshSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  session = data.session;
  profileActive = false;
  if (session?.user) {
    const { data: profile, error: profileError } = await supabase
      .from('student_profiles')
      .select('id, status')
      .eq('id', supabaseConfig.profileId)
      .maybeSingle();
    if (profileError) throw profileError;
    profileActive = profile?.status === 'active';
  }
  updateSessionUi();
  return { session, profileActive };
}

function updateSessionUi() {
  const indicator = document.querySelector('#sessionIndicator');
  const logout = document.querySelector('#sidebarLogout');
  if (!indicator) return;
  if (session?.user && profileActive) {
    indicator.textContent = 'Sessão ativa';
    indicator.dataset.state = 'active';
    logout.hidden = false;
  } else {
    indicator.textContent = 'Acesso necessário';
    indicator.dataset.state = 'inactive';
    logout.hidden = true;
  }
}

function requireLoginMessage(target, message = 'Entre na plataforma para acessar esta área privada.') {
  const card = el('section', { className: 'card empty-card' });
  card.append(el('h2', { text: 'Acesso individual' }), el('p', { text: message }));
  card.append(el('a', { className: 'primary-link', text: 'Ir para o acesso', href: 'index.html#acesso' }));
  target.replaceChildren(card);
}

function renderLoginCard(container) {
  const card = el('section', { className: 'card auth-card', id: 'acesso' });
  const intro = el('div');
  intro.append(el('p', { className: 'eyebrow', text: 'Acesso individual' }), el('h2', { text: session?.user ? 'Sessão ativa' : 'Entrar' }));
  const status = el('p', { className: 'inline-status' });
  card.append(intro);

  if (session?.user && profileActive) {
    card.append(el('p', { text: 'O perfil STU-MYCHAEL está autenticado e pode salvar o progresso.' }));
    const logout = el('button', { className: 'secondary-button', text: 'Sair' });
    logout.type = 'button';
    logout.addEventListener('click', async () => {
      await supabase.auth.signOut();
      await refreshSession();
      await renderCurrentPage();
    });
    card.append(logout, status);
    container.append(card);
    return;
  }

  const form = el('form', { className: 'auth-form' });
  const emailLabel = el('label', { text: 'E-mail' });
  emailLabel.htmlFor = 'email';
  const email = el('input', { id: 'email' });
  email.name = 'email';
  email.type = 'email';
  email.autocomplete = 'username';
  email.required = true;
  const passwordLabel = el('label', { text: 'Senha' });
  passwordLabel.htmlFor = 'password';
  const password = el('input', { id: 'password' });
  password.name = 'password';
  password.type = 'password';
  password.autocomplete = 'current-password';
  password.minLength = 8;
  password.required = true;
  const submit = el('button', { text: 'Entrar' });
  submit.type = 'submit';
  form.append(emailLabel, email, passwordLabel, password, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Entrando…';
    status.textContent = '';
    const formData = new FormData(form);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? '')
    });
    if (error) {
      status.textContent = 'Não foi possível entrar. Confira os dados e tente novamente.';
      submit.disabled = false;
      submit.textContent = 'Entrar';
      return;
    }
    await refreshSession();
    await renderCurrentPage();
  });
  card.append(form, status);
  container.append(card);
}

function metric(value, label, href) {
  const article = el('article', { className: 'metric-card' });
  article.append(el('strong', { text: String(value) }), el('span', { text: label }));
  if (href) article.append(el('a', { href, text: 'Abrir' }));
  return article;
}

async function renderHome(target) {
  const unit = firstUnit();
  const hero = el('section', { className: 'hero-card' });
  hero.append(
    el('p', { className: 'status-pill', text: 'Conteúdo publicado e validado' }),
    el('h2', { text: 'Uma tarefa por vez.' }),
    el('p', { text: unit ? `Continue pela unidade “${unit.title}”.` : 'Nenhuma unidade está disponível.' })
  );
  if (unit) {
    const actions = el('div', { className: 'button-row' });
    actions.append(
      el('a', { className: 'primary-link', text: 'Continuar estudo', href: pageUrl('study', { unit: unit.id }) }),
      el('a', { className: 'secondary-link', text: 'Responder questões', href: pageUrl('questions', { unit: unit.id }) })
    );
    hero.append(actions);
  }
  target.append(hero);

  const metrics = el('section', { className: 'metric-grid', id: 'resumo' });
  metrics.append(
    metric(catalog.units.length, 'unidades publicadas', 'materias.html'),
    metric(catalog.questions.length, 'questões disponíveis', 'questoes.html'),
    metric(catalog.tafRecords?.length ?? 0, 'referências de TAF', 'taf.html')
  );
  target.append(metrics);

  const next = el('section', { className: 'card action-grid' });
  const heading = el('div', { className: 'section-heading' });
  heading.append(el('p', { className: 'eyebrow', text: 'Próximos passos' }), el('h2', { text: 'Escolha uma área' }));
  next.append(heading);
  const links = el('div', { className: 'module-grid' });
  for (const [title, text, href] of [
    ['Estudo', 'Leia a aula sem misturar teoria e questões.', 'estudar.html'],
    ['Questões', 'Pratique todas ou somente as que errou.', 'questoes.html'],
    ['Revisões', 'Veja o que está agendado para retomar.', 'revisoes.html'],
    ['Caderno de erros', 'Acompanhe e refaça os itens pendentes.', 'erros.html'],
    ['Desempenho', 'Consulte o resumo privado do progresso.', 'desempenho.html']
  ]) {
    const link = el('a', { className: 'module-card', href });
    link.append(el('h3', { text: title }), el('p', { text }));
    links.append(link);
  }
  next.append(links);
  target.append(next);
  renderLoginCard(target);
}

function renderMaterialBlock(block) {
  if (block.type === 'heading') return el('h2', { text: block.text });
  if (block.type === 'subheading') return el('h3', { text: block.text });
  if (block.type === 'paragraph') return el('p', { text: block.text });
  if (block.type === 'quote') return el('blockquote', { text: block.text });
  if (block.type === 'bullets' || block.type === 'numbered') {
    const list = el(block.type === 'numbered' ? 'ol' : 'ul');
    for (const item of block.items ?? []) list.append(el('li', { text: item }));
    return list;
  }
  if (block.type === 'callout') {
    const box = el('aside', { className: `lesson-callout ${block.tone ?? 'tip'}` });
    if (block.text) box.append(el('p', { text: block.text }));
    if (block.items?.length) {
      const list = el('ul');
      for (const item of block.items) list.append(el('li', { text: item }));
      box.append(list);
    }
    return box;
  }
  if (block.type === 'table') {
    const wrap = el('div', { className: 'table-scroll' });
    const table = el('table', { className: 'lesson-table' });
    const head = el('thead');
    const headRow = el('tr');
    for (const item of block.headers ?? []) headRow.append(el('th', { text: item }));
    head.append(headRow);
    const body = el('tbody');
    for (const row of block.rows ?? []) {
      const tr = el('tr');
      for (const item of row) tr.append(el('td', { text: item }));
      body.append(tr);
    }
    table.append(head, body);
    wrap.append(table);
    return wrap;
  }
  if (block.type === 'sources') {
    const list = el('ul');
    for (const sourceId of block.sourceIds ?? []) {
      const source = findById(catalog.sources, sourceId);
      if (!source) continue;
      const item = el('li');
      const link = el('a', { href: source.url, text: source.title });
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      item.append(link);
      list.append(item);
    }
    return list;
  }
  return el('p');
}

async function renderStudy(target) {
  const unit = currentUnit();
  if (!unit) return target.append(el('section', { className: 'card empty-card', text: 'Nenhuma unidade publicada.' }));
  const material = findById(catalog.materials, unit.materialIds?.[0]);
  const subject = findById(catalog.subjects, unit.subjectId);
  const header = el('section', { className: 'card lesson-summary' });
  header.append(
    el('p', { className: 'eyebrow', text: subject?.name ?? 'Unidade' }),
    el('h2', { text: unit.title }),
    el('p', { text: unit.objective })
  );
  const meta = el('div', { className: 'tag-row' });
  for (const value of [unit.stage, unit.level, `${unit.estimatedMinutes} min`]) meta.append(el('span', { text: value }));
  header.append(meta);
  target.append(header);
  if (!material) return target.append(el('section', { className: 'card empty-card', text: 'Material não localizado.' }));
  const lesson = el('article', { className: 'card lesson' });
  lesson.append(el('h1', { text: material.title }), el('p', { className: 'lead', text: material.objective }));
  for (const block of material.blocks ?? []) lesson.append(renderMaterialBlock(block));
  const footer = el('div', { className: 'lesson-footer' });
  footer.append(el('a', { className: 'primary-link', text: 'Praticar agora', href: pageUrl('questions', { unit: unit.id }) }));
  lesson.append(footer);
  target.append(lesson);
}

async function renderSubjects(target) {
  if (!catalog.subjects.length) return target.append(el('section', { className: 'card empty-card', text: 'Nenhuma matéria publicada.' }));
  const grid = el('section', { className: 'subject-grid' });
  for (const subject of [...catalog.subjects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const card = el('article', { className: 'card subject-card' });
    card.append(el('p', { className: 'eyebrow', text: subject.area ?? 'Matéria' }), el('h2', { text: subject.name }));
    const units = catalog.units.filter((unit) => unit.subjectId === subject.id);
    card.append(el('p', { text: `${units.length} unidade(s) publicada(s).` }));
    const list = el('div', { className: 'unit-list' });
    for (const unit of units) {
      const link = el('a', { href: pageUrl('study', { unit: unit.id }), className: 'unit-link' });
      link.append(el('strong', { text: unit.title }), el('span', { text: `${unit.stage} · ${unit.estimatedMinutes} min` }));
      list.append(link);
    }
    card.append(list);
    grid.append(card);
  }
  target.append(grid);
}

async function loadLatestAttempts(questionIds = []) {
  if (!session?.user || !profileActive || questionIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('question_attempts')
    .select('id, question_id, answer, is_correct, attempt_number, answered_at')
    .eq('profile_id', supabaseConfig.profileId)
    .in('question_id', questionIds)
    .order('answered_at', { ascending: false });
  if (error) throw error;
  const map = new Map();
  for (const row of data ?? []) if (!map.has(row.question_id)) map.set(row.question_id, row);
  return map;
}

async function loadOpenErrorQuestionIds() {
  if (!session?.user || !profileActive) return [];
  const { data, error } = await supabase
    .from('error_items')
    .select('question_id, status, created_at')
    .eq('profile_id', supabaseConfig.profileId)
    .in('status', ['open', 'reviewing'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.question_id))];
}

async function ensureUnitStarted(unitId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('study_units')
    .select('id, status')
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
  } else if (data.status !== 'completed') {
    const { error: updateError } = await supabase.from('study_units').update({
      status: 'in_progress',
      last_activity_at: now
    }).eq('id', data.id);
    if (updateError) throw updateError;
  }
}

async function scheduleReview(questionId) {
  const next = new Date(Date.now() + 86_400_000).toISOString();
  const { error } = await supabase.from('review_items').upsert({
    profile_id: supabaseConfig.profileId,
    source_type: 'question',
    source_id: questionId,
    reason: 'wrong_answer',
    status: 'scheduled',
    next_review_at: next,
    interval_days: 1
  }, { onConflict: 'profile_id,source_type,source_id' });
  if (error) throw error;
}

async function registerError(questionId, attemptId) {
  const { data, error } = await supabase
    .from('error_items')
    .select('id')
    .eq('profile_id', supabaseConfig.profileId)
    .eq('question_id', questionId)
    .in('status', ['open', 'reviewing'])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    const { error: updateError } = await supabase.from('error_items').update({
      attempt_id: attemptId,
      status: 'open',
      resolved_at: null
    }).eq('id', data.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from('error_items').insert({
      profile_id: supabaseConfig.profileId,
      question_id: questionId,
      attempt_id: attemptId,
      error_type: 'interpretation',
      status: 'open'
    });
    if (insertError) throw insertError;
  }
  await scheduleReview(questionId);
}

async function resolveError(questionId) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('error_items').update({
    status: 'resolved',
    resolved_at: now
  })
    .eq('profile_id', supabaseConfig.profileId)
    .eq('question_id', questionId)
    .in('status', ['open', 'reviewing']);
  if (error) throw error;

  const { data: review, error: reviewError } = await supabase
    .from('review_items')
    .select('id, repetitions')
    .eq('profile_id', supabaseConfig.profileId)
    .eq('source_type', 'question')
    .eq('source_id', questionId)
    .maybeSingle();
  if (reviewError) throw reviewError;
  if (review) {
    const { error: completeError } = await supabase.from('review_items').update({
      status: 'completed',
      last_reviewed_at: now,
      repetitions: (review.repetitions ?? 0) + 1
    }).eq('id', review.id);
    if (completeError) throw completeError;
  }
}

async function updateUnitProgress(unit) {
  const { data, error } = await supabase
    .from('question_attempts')
    .select('question_id, is_correct, answered_at')
    .eq('profile_id', supabaseConfig.profileId)
    .eq('unit_id', unit.id)
    .order('answered_at', { ascending: false });
  if (error) throw error;
  const latest = new Map();
  for (const row of data ?? []) if (!latest.has(row.question_id)) latest.set(row.question_id, row);
  const total = unit.questionIds.length;
  const answered = unit.questionIds.filter((id) => latest.has(id)).length;
  const correct = unit.questionIds.filter((id) => latest.get(id)?.is_correct).length;
  const mastery = total ? Math.round((correct / total) * 100) : 0;
  const completed = answered === total;
  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from('study_units').update({
    status: completed ? 'completed' : 'in_progress',
    mastery_percent: mastery,
    completed_at: completed ? now : null,
    last_activity_at: now
  }).eq('profile_id', supabaseConfig.profileId).eq('unit_id', unit.id);
  if (updateError) throw updateError;
}

async function saveAttempt(question, unit, answer) {
  await ensureUnitStarted(unit.id);
  const { count, error: countError } = await supabase
    .from('question_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', supabaseConfig.profileId)
    .eq('question_id', question.id);
  if (countError) throw countError;
  const isCorrect = answer === question.answer;
  const started = questionTimers.get(question.id) ?? Date.now();
  const { data: attempt, error } = await supabase.from('question_attempts').insert({
    profile_id: supabaseConfig.profileId,
    question_id: question.id,
    unit_id: unit.id,
    question_set_id: unit.questionSetIds?.[0] ?? null,
    answer,
    is_correct: isCorrect,
    duration_ms: Math.max(0, Date.now() - started),
    attempt_number: (count ?? 0) + 1,
    client_event_id: crypto.randomUUID()
  }).select('id, question_id, answer, is_correct, attempt_number, answered_at').single();
  if (error) throw error;
  if (isCorrect) await resolveError(question.id);
  else await registerError(question.id, attempt.id);
  await updateUnitProgress(unit);
  return attempt;
}

function feedback(question, attempt) {
  const box = el('div', { className: `feedback ${attempt.is_correct ? 'correct' : 'incorrect'}` });
  box.append(el('strong', { text: attempt.is_correct ? 'Resposta correta.' : `Resposta incorreta. Gabarito: ${question.answer}.` }));
  box.append(el('p', { text: question.commentary }));
  const foundation = el('p');
  foundation.append(el('strong', { text: 'Fundamento: ' }), document.createTextNode(question.foundation));
  box.append(foundation);
  return box;
}

function questionScope(mode, openErrors) {
  if (mode !== 'errors') {
    const unit = currentUnit();
    return {
      unit,
      global: false,
      questions: unit?.questionIds.map((id) => findById(catalog.questions, id)).filter(Boolean) ?? []
    };
  }
  const unit = requestedUnit();
  const candidates = unit
    ? unit.questionIds.map((id) => findById(catalog.questions, id)).filter(Boolean)
    : catalog.questions;
  return {
    unit,
    global: !unit,
    questions: candidates.filter((question) => openErrors.includes(question.id))
  };
}

async function renderQuestions(target) {
  if (!session?.user || !profileActive) return requireLoginMessage(target, 'Entre para responder questões e salvar tentativas.');
  const mode = queryParam('mode') === 'errors' ? 'errors' : 'all';
  const openErrors = await loadOpenErrorQuestionIds();
  const scope = questionScope(mode, openErrors);
  if (mode === 'all' && !scope.unit) return target.append(el('section', { className: 'card empty-card', text: 'Nenhuma unidade publicada.' }));
  const questions = scope.questions;
  const latest = mode === 'all' ? await loadLatestAttempts(questions.map(({ id }) => id)) : new Map();
  const retryAttempts = new Map();
  let index = Math.max(0, questions.findIndex(({ id }) => id === queryParam('question')));

  const top = el('section', { className: 'card question-toolbar' });
  const tabs = el('div', { className: 'filter-tabs' });
  const allLinkUnit = scope.unit ?? firstUnit();
  const scopedErrorCount = scope.unit
    ? scope.unit.questionIds.filter((id) => openErrors.includes(id)).length
    : openErrors.length;
  tabs.append(
    el('a', {
      className: mode === 'all' ? 'active' : '',
      text: scope.global ? 'Todas as questões' : 'Todas da unidade',
      href: pageUrl('questions', allLinkUnit ? { unit: allLinkUnit.id } : {})
    }),
    el('a', {
      className: mode === 'errors' ? 'active' : '',
      text: `Refazer erradas (${scopedErrorCount})`,
      href: pageUrl('questions', scope.unit ? { unit: scope.unit.id, mode: 'errors' } : { mode: 'errors' })
    })
  );
  const heading = el('div', { className: 'section-heading' });
  const scopeLabel = scope.global ? 'Todas as unidades' : scope.unit?.title ?? 'Questões';
  heading.append(
    el('p', { className: 'eyebrow', text: scopeLabel }),
    el('h2', { text: mode === 'errors' ? 'Refazer questões erradas' : 'Questões da unidade' })
  );
  top.append(heading, tabs);
  target.append(top);

  if (!questions.length) {
    const empty = el('section', { className: 'card empty-card' });
    empty.append(el('h2', { text: mode === 'errors' ? 'Nenhum erro pendente' : 'Nenhuma questão disponível' }));
    empty.append(el('p', { text: mode === 'errors' ? 'As questões corrigidas saem do caderno de erros, mas as tentativas continuam no histórico.' : 'Aguarde a publicação de novas questões.' }));
    target.append(empty);
    return;
  }

  const workspace = el('section', { className: 'question-layout' });
  const palette = el('aside', { className: 'card question-palette' });
  palette.setAttribute('aria-label', 'Navegação entre questões');
  palette.append(el('h3', { text: 'Questões' }));
  const paletteGrid = el('div', { className: 'palette-grid' });
  const stage = el('div', { className: 'question-stage' });
  palette.append(paletteGrid);
  workspace.append(palette, stage);
  target.append(workspace);

  const draw = () => {
    paletteGrid.replaceChildren();
    questions.forEach((question, position) => {
      const visible = mode === 'errors' ? retryAttempts.get(question.id) : latest.get(question.id);
      const button = el('button', {
        className: `palette-button ${position === index ? 'active' : ''} ${visible?.is_correct ? 'correct' : visible ? 'incorrect' : ''}`,
        text: String(position + 1)
      });
      button.type = 'button';
      button.setAttribute('aria-label', `Abrir questão ${position + 1}`);
      button.addEventListener('click', () => { index = position; draw(); });
      paletteGrid.append(button);
    });

    const question = questions[index];
    const unit = unitForQuestion(question);
    if (!unit) {
      stage.replaceChildren(el('section', { className: 'card empty-card', text: 'A unidade desta questão não foi localizada.' }));
      return;
    }
    if (!questionTimers.has(question.id)) questionTimers.set(question.id, Date.now());
    const visibleAttempt = mode === 'errors' ? retryAttempts.get(question.id) : latest.get(question.id);
    const card = el('article', { className: 'card question-card' });
    card.dataset.questionId = question.id;
    card.append(
      el('p', { className: 'question-number', text: `Questão ${index + 1} de ${questions.length} · ${question.difficulty}` }),
      el('h2', { text: question.statement })
    );
    if (scope.global) card.prepend(el('p', { className: 'eyebrow', text: unit.title }));
    const form = el('form', { className: 'question-form' });
    const fieldset = el('fieldset');
    fieldset.append(el('legend', { text: 'Escolha uma alternativa' }));
    for (const option of question.options ?? []) {
      const label = el('label', { className: 'option-row' });
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `answer-${question.id}`;
      input.value = option.id;
      input.required = true;
      if (mode === 'all' && visibleAttempt?.answer === option.id) input.checked = true;
      label.append(input, el('span', { className: 'option-marker', text: option.id }), el('span', { text: option.text }));
      fieldset.append(label);
    }
    const status = el('span', { className: 'question-save-status' });
    const submit = el('button', { text: mode === 'errors' ? 'Refazer questão' : visibleAttempt ? 'Responder novamente' : 'Responder' });
    submit.type = 'submit';
    const actions = el('div', { className: 'question-actions' });
    actions.append(submit, status);
    form.append(fieldset, actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const answer = new FormData(form).get(`answer-${question.id}`);
      if (!answer) return;
      submit.disabled = true;
      submit.textContent = 'Salvando…';
      try {
        const attempt = await saveAttempt(question, unit, String(answer));
        if (mode === 'errors') retryAttempts.set(question.id, attempt);
        else latest.set(question.id, attempt);
        status.textContent = attempt.is_correct
          ? 'Correto. O erro foi resolvido.'
          : mode === 'errors'
            ? 'Nova tentativa salva; a questão permanece no caderno.'
            : 'Tentativa salva no caderno de erros.';
        if (mode === 'errors' && attempt.is_correct) {
          const destination = scope.unit
            ? pageUrl('questions', { unit: scope.unit.id, mode: 'errors' })
            : pageUrl('questions', { mode: 'errors' });
          window.location.href = destination;
          return;
        }
        draw();
      } catch (error) {
        console.error(error);
        status.textContent = 'Não foi possível salvar. Tente novamente.';
        submit.disabled = false;
        submit.textContent = mode === 'errors' ? 'Refazer questão' : visibleAttempt ? 'Responder novamente' : 'Responder';
      }
    });
    card.append(form);
    if (visibleAttempt) card.append(feedback(question, visibleAttempt));

    const nav = el('div', { className: 'question-nav' });
    const previous = el('button', { className: 'secondary-button', text: 'Anterior' });
    previous.type = 'button';
    previous.disabled = index === 0;
    previous.addEventListener('click', () => { index -= 1; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    const next = el('button', { className: 'secondary-button', text: index === questions.length - 1 ? 'Fim da lista' : 'Próxima' });
    next.type = 'button';
    next.disabled = index === questions.length - 1;
    next.addEventListener('click', () => { index += 1; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    nav.append(previous, next);
    card.append(nav);
    stage.replaceChildren(card);
  };
  draw();
}

async function renderReviews(target) {
  if (!session?.user || !profileActive) return requireLoginMessage(target);
  const { data, error } = await supabase
    .from('review_items')
    .select('id, source_type, source_id, reason, status, repetitions, next_review_at')
    .eq('profile_id', supabaseConfig.profileId)
    .in('status', ['scheduled', 'due'])
    .order('next_review_at', { ascending: true });
  if (error) throw error;
  if (!data?.length) return target.append(el('section', { className: 'card empty-card', text: 'Nenhuma revisão pendente.' }));
  const list = el('section', { className: 'card list-card' });
  for (const item of data) {
    const question = item.source_type === 'question' ? findById(catalog.questions, item.source_id) : null;
    const row = el('article', { className: 'list-item' });
    const copy = el('div');
    copy.append(el('span', { className: `status-pill ${item.status}`, text: item.status === 'due' ? 'Revisão vencida' : 'Agendada' }), el('h2', { text: question?.title ?? item.source_id }));
    copy.append(el('p', { text: item.next_review_at ? `Próxima revisão: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.next_review_at))}` : 'Data não definida.' }));
    row.append(copy);
    if (question) row.append(el('a', { className: 'primary-link', text: 'Revisar questão', href: pageUrl('questions', { unit: question.unitId, mode: 'errors', question: question.id }) }));
    list.append(row);
  }
  target.append(list);
}

async function renderErrors(target) {
  if (!session?.user || !profileActive) return requireLoginMessage(target);
  const { data, error } = await supabase
    .from('error_items')
    .select('id, question_id, error_type, notes, status, created_at, updated_at')
    .eq('profile_id', supabaseConfig.profileId)
    .in('status', ['open', 'reviewing'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  const unique = new Map();
  for (const row of data ?? []) if (!unique.has(row.question_id)) unique.set(row.question_id, row);
  const rows = [...unique.values()];
  const summary = el('section', { className: 'card error-summary' });
  const copy = el('div');
  copy.append(
    el('p', { className: 'eyebrow', text: 'Pendências atuais' }),
    el('h2', { text: `${rows.length} questão(ões) para refazer` }),
    el('p', { text: 'Ao acertar novamente, a questão sai da lista pendente. O histórico da tentativa permanece salvo.' })
  );
  summary.append(copy);
  if (rows.length) summary.append(el('a', { className: 'primary-link', text: 'Refazer todas', href: pageUrl('questions', { mode: 'errors' }) }));
  target.append(summary);
  if (!rows.length) return target.append(el('section', { className: 'card empty-card', text: 'Nenhuma questão pendente no caderno de erros.' }));
  const list = el('section', { className: 'error-grid' });
  for (const row of rows) {
    const question = findById(catalog.questions, row.question_id);
    if (!question) continue;
    const unit = unitForQuestion(question);
    const card = el('article', { className: 'card error-card' });
    card.append(
      el('p', { className: 'eyebrow', text: unit?.title ?? question.difficulty }),
      el('h2', { text: question.title }),
      el('p', { text: question.statement })
    );
    const actions = el('div', { className: 'button-row' });
    actions.append(el('a', { className: 'primary-link', text: 'Refazer esta questão', href: pageUrl('questions', { unit: question.unitId, mode: 'errors', question: question.id }) }));
    card.append(actions);
    list.append(card);
  }
  target.append(list);
}

async function renderPerformance(target) {
  if (!session?.user || !profileActive) return requireLoginMessage(target);
  const [attemptsResult, unitsResult, errorsResult, reviewsResult] = await Promise.all([
    supabase.from('question_attempts').select('question_id, is_correct, answered_at').eq('profile_id', supabaseConfig.profileId),
    supabase.from('study_units').select('unit_id, status, mastery_percent').eq('profile_id', supabaseConfig.profileId),
    supabase.from('error_items').select('question_id, status').eq('profile_id', supabaseConfig.profileId).in('status', ['open', 'reviewing']),
    supabase.from('review_items').select('source_id, status').eq('profile_id', supabaseConfig.profileId).in('status', ['scheduled', 'due'])
  ]);
  for (const result of [attemptsResult, unitsResult, errorsResult, reviewsResult]) if (result.error) throw result.error;
  const attempts = attemptsResult.data ?? [];
  const correct = attempts.filter(({ is_correct }) => is_correct).length;
  const accuracy = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
  const completedUnits = (unitsResult.data ?? []).filter(({ status }) => status === 'completed').length;
  const uniqueErrors = new Set((errorsResult.data ?? []).map(({ question_id }) => question_id)).size;
  const pendingReviews = reviewsResult.data?.length ?? 0;
  const grid = el('section', { className: 'performance-grid' });
  grid.append(
    metric(attempts.length, 'tentativas registradas'),
    metric(`${accuracy}%`, 'aproveitamento geral'),
    metric(completedUnits, 'unidades concluídas'),
    metric(uniqueErrors, 'erros pendentes', 'erros.html'),
    metric(pendingReviews, 'revisões pendentes', 'revisoes.html')
  );
  target.append(grid);
}

async function renderPlaceholder(target, type) {
  const copy = {
    exams: ['Provas anteriores', 'O acervo será publicado somente com prova, fonte e gabarito definitivo validados.'],
    simulations: ['Simulados', 'Este módulo será liberado gradualmente, depois da formação de uma base mínima.'],
    taf: ['TAF', 'Área criada, ainda sem treino publicado. Índices históricos não são índices vigentes; treino não substitui avaliação médica, orientação profissional ou teste oficial.']
  }[type];
  const card = el('section', { className: `card empty-card ${type === 'taf' ? 'warning-card' : ''}` });
  card.append(el('h2', { text: copy[0] }), el('p', { text: copy[1] }));
  target.append(card);
}

async function renderSettings(target) {
  renderLoginCard(target);
  const card = el('section', { className: 'card settings-card' });
  card.append(el('h2', { text: 'Configuração da plataforma' }));
  const list = el('dl', { className: 'definition-list' });
  for (const [term, description] of [
    ['Perfil técnico', 'STU-MYCHAEL'],
    ['Redação', 'Desativada no MVP'],
    ['TAF', 'Área prevista no MVP; treino ainda não publicado'],
    ['Progresso', 'Supabase com acesso individual']
  ]) {
    list.append(el('dt', { text: term }), el('dd', { text: description }));
  }
  card.append(list);
  target.append(card);
}

async function renderCurrentPage() {
  const target = document.querySelector('#pageContent');
  target.replaceChildren();
  setStatus('');
  const renderers = {
    home: renderHome,
    study: renderStudy,
    subjects: renderSubjects,
    questions: renderQuestions,
    reviews: renderReviews,
    errors: renderErrors,
    performance: renderPerformance,
    exams: (node) => renderPlaceholder(node, 'exams'),
    simulations: (node) => renderPlaceholder(node, 'simulations'),
    taf: (node) => renderPlaceholder(node, 'taf'),
    settings: renderSettings
  };
  try {
    await (renderers[pageId] ?? renderHome)(target);
  } catch (error) {
    console.error(error);
    setStatus('Não foi possível carregar esta página. Atualize e tente novamente.', 'error');
  }
}

async function boot() {
  buildShell();
  document.querySelector('#sidebarLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    await refreshSession();
    await renderCurrentPage();
  });
  setStatus('Carregando…');
  try {
    await Promise.all([loadCatalog(), refreshSession()]);
    setStatus('');
    await renderCurrentPage();
  } catch (error) {
    console.error(error);
    setStatus('Falha ao carregar a plataforma. Atualize a página e tente novamente.', 'error');
  }
  supabase.auth.onAuthStateChange(async () => {
    await refreshSession();
    await renderCurrentPage();
  });
}

boot();
