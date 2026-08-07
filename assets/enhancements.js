const pageId = document.body.dataset.page || 'home';
const STORAGE_PREFIX = 'mychael-pm:';
const THEME_KEY = `${STORAGE_PREFIX}theme`;
const READER_KEY = `${STORAGE_PREFIX}reader`;
const SEARCH_LIMIT = 10;

const NAV_GROUPS = [
  ['Estudar', [
    ['home', 'Início', 'index.html', '⌂'],
    ['study', 'Estudo de hoje', 'estudar.html', '▤'],
    ['subjects', 'Matérias', 'materias.html', '▦'],
    ['schedule', 'Cronograma', 'cronograma.html', '◎']
  ]],
  ['Praticar', [
    ['questions', 'Questões', 'questoes.html', '?'],
    ['reviews', 'Revisões', 'revisoes.html', '↻'],
    ['errors', 'Caderno de erros', 'erros.html', '!']
  ]],
  ['Provas', [
    ['exams', 'Provas anteriores', 'provas.html', '▧'],
    ['simulations', 'Simulados', 'simulados.html', '◷']
  ]],
  ['Evolução', [
    ['performance', 'Desempenho', 'desempenho.html', '◫'],
    ['taf', 'TAF', 'taf.html', '✓']
  ]],
  ['Sistema', [
    ['settings', 'Configurações', 'configuracoes.html', '⚙']
  ]]
];

const PAGE_LABELS = {
  home: 'Início',
  study: 'Estudo de hoje',
  subjects: 'Matérias',
  schedule: 'Cronograma',
  questions: 'Questões',
  reviews: 'Revisões',
  errors: 'Caderno de erros',
  exams: 'Provas anteriores',
  simulations: 'Simulados',
  performance: 'Desempenho',
  taf: 'TAF',
  settings: 'Configurações'
};

const state = {
  catalogPromise: null,
  deploymentPromise: null,
  refreshQueued: false,
  readerScrollBound: false
};

function injectStyles() {
  if (document.querySelector('link[data-mychael-enhancements]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './assets/enhancements.css';
  link.dataset.mychaelEnhancements = 'true';
  document.head.append(link);
}

function preferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (['light', 'dark', 'comfort'].includes(saved)) return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const safeTheme = ['light', 'dark', 'comfort'].includes(theme) ? theme : 'light';
  document.documentElement.dataset.theme = safeTheme;
  localStorage.setItem(THEME_KEY, safeTheme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = safeTheme === 'dark' ? '#101b1a' : safeTheme === 'comfort' ? '#ece3cf' : '#173532';
  const button = document.querySelector('#themeToggle');
  if (button) {
    const names = { light: 'Claro', dark: 'Escuro', comfort: 'Conforto' };
    button.textContent = `◐ ${names[safeTheme]}`;
    button.setAttribute('aria-label', `Tema atual: ${names[safeTheme]}. Alterar tema.`);
  }
}

function cycleTheme() {
  const order = ['light', 'dark', 'comfort'];
  const current = document.documentElement.dataset.theme || preferredTheme();
  applyTheme(order[(order.indexOf(current) + 1) % order.length]);
}

function loadCatalog() {
  if (!state.catalogPromise) {
    state.catalogPromise = fetch('./content/catalog.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Catálogo indisponível.');
        return response.json();
      })
      .catch((error) => {
        console.warn('Enhancements: catálogo indisponível.', error);
        return null;
      });
  }
  return state.catalogPromise;
}

function loadDeployment() {
  if (!state.deploymentPromise) {
    state.deploymentPromise = (async () => {
      try {
        const response = await fetch('./content/deployment.json', { cache: 'no-store' });
        if (response.ok) return { source: 'deployment', data: await response.json() };
      } catch {}
      try {
        const response = await fetch('./content/manifest.json', { cache: 'no-store' });
        if (response.ok) return { source: 'manifest', data: await response.json() };
      } catch {}
      return { source: 'none', data: null };
    })();
  }
  return state.deploymentPromise;
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function formatLongClock(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function rebuildNavigation() {
  const nav = document.querySelector('#mainNav');
  if (!nav || nav.dataset.grouped === 'true') return;
  nav.replaceChildren();
  nav.classList.add('grouped-nav');
  for (const [groupName, items] of NAV_GROUPS) {
    const group = make('section', 'nav-group');
    const label = make('p', 'nav-group-label', groupName);
    group.append(label);
    for (const [id, labelText, href, icon] of items) {
      const link = make('a', id === pageId ? 'active' : '');
      link.href = href;
      if (id === pageId) link.setAttribute('aria-current', 'page');
      const iconNode = make('span', 'nav-icon', icon);
      const textNode = make('span', '', labelText);
      link.append(iconNode, textNode);
      group.append(link);
    }
    nav.append(group);
  }
  nav.dataset.grouped = 'true';
}

function enhanceBrand() {
  const brand = document.querySelector('.sidebar .brand');
  if (brand && !brand.dataset.enhanced) {
    brand.dataset.enhanced = 'true';
    brand.classList.add('brand-panel');
    const strong = brand.querySelector('strong');
    const small = brand.querySelector('small');
    if (strong) strong.textContent = 'Mychael PM';
    if (small) small.textContent = 'PMDF • PMGO • PMMG';
  }
  const mobile = document.querySelector('.mobile-brand span:last-child');
  if (mobile) mobile.textContent = 'Mychael PM';
}

function createUtilityPanel() {
  const sidebar = document.querySelector('.sidebar');
  const nav = document.querySelector('#mainNav');
  if (!sidebar || !nav || document.querySelector('#studyUtilities')) return;
  const panel = make('div', 'study-utilities');
  panel.id = 'studyUtilities';
  const scope = make('div', 'competition-scope');
  scope.innerHTML = '<span>Foco da plataforma</span><strong>PMDF · PMGO · PMMG</strong>';
  const row = make('div', 'utility-row');
  const theme = make('button', 'utility-button');
  theme.type = 'button';
  theme.id = 'themeToggle';
  theme.addEventListener('click', cycleTheme);
  const search = make('button', 'utility-button', '⌕ Buscar');
  search.type = 'button';
  search.addEventListener('click', openSearch);
  row.append(theme, search);
  panel.append(scope, row);
  sidebar.insertBefore(panel, nav);
  applyTheme(document.documentElement.dataset.theme || preferredTheme());
}

function createSearchDialog() {
  if (document.querySelector('#globalSearchDialog')) return document.querySelector('#globalSearchDialog');
  const dialog = make('dialog', 'search-dialog');
  dialog.id = 'globalSearchDialog';
  const panel = make('div', 'search-panel');
  const header = make('div', 'search-header');
  const titleWrap = make('div');
  titleWrap.append(make('p', 'eyebrow', 'Busca rápida'), make('h2', '', 'Encontre o que precisa'));
  const close = make('button', 'secondary-button', 'Fechar');
  close.type = 'button';
  close.addEventListener('click', () => dialog.close());
  header.append(titleWrap, close);
  const input = make('input', 'search-input');
  input.type = 'search';
  input.placeholder = 'Digite matéria, assunto, aula ou trecho da questão…';
  input.setAttribute('aria-label', 'Buscar na plataforma');
  const results = make('div', 'search-results');
  results.id = 'globalSearchResults';
  input.addEventListener('input', () => renderSearchResults(input.value, results));
  panel.append(header, input, results);
  dialog.append(panel);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.body.append(dialog);
  return dialog;
}

async function openSearch() {
  const dialog = createSearchDialog();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  const input = dialog.querySelector('input');
  input?.focus();
  await loadCatalog();
  renderSearchResults(input?.value ?? '', dialog.querySelector('#globalSearchResults'));
}

async function renderSearchResults(rawQuery, target) {
  if (!target) return;
  const query = String(rawQuery ?? '').trim().toLocaleLowerCase('pt-BR');
  if (query.length < 2) {
    target.innerHTML = '<p class="search-hint">Digite pelo menos duas letras. A busca consulta matérias, aulas e questões publicadas.</p>';
    return;
  }
  const catalog = await loadCatalog();
  if (!catalog) return;
  const entries = [];
  for (const subject of catalog.subjects ?? []) {
    if (`${subject.name} ${subject.area ?? ''}`.toLocaleLowerCase('pt-BR').includes(query)) {
      entries.push({ type: 'Matéria', title: subject.name, detail: subject.area ?? '', href: `materias.html#${subject.id}` });
    }
  }
  for (const unit of catalog.units ?? []) {
    if (`${unit.title} ${unit.objective ?? ''}`.toLocaleLowerCase('pt-BR').includes(query)) {
      entries.push({ type: 'Aula', title: unit.title, detail: unit.objective ?? '', href: `estudar.html?unit=${encodeURIComponent(unit.id)}` });
    }
  }
  for (const question of catalog.questions ?? []) {
    if (`${question.title ?? ''} ${question.statement ?? ''}`.toLocaleLowerCase('pt-BR').includes(query)) {
      entries.push({ type: 'Questão', title: question.title ?? question.id, detail: question.statement ?? '', href: `questoes.html?unit=${encodeURIComponent(question.unitId)}&question=${encodeURIComponent(question.id)}` });
    }
    if (entries.length >= SEARCH_LIMIT * 3) break;
  }
  target.replaceChildren();
  if (!entries.length) {
    target.append(make('p', 'search-hint', 'Nenhum resultado encontrado. Tente outra palavra-chave.'));
    return;
  }
  for (const entry of entries.slice(0, SEARCH_LIMIT)) {
    const link = make('a', 'search-result');
    link.href = entry.href;
    link.append(make('span', 'status-pill', entry.type), make('strong', '', entry.title));
    if (entry.detail) link.append(make('small', '', entry.detail));
    target.append(link);
  }
}

function createMobileBottomNav() {
  if (document.querySelector('.mobile-bottom-nav')) return;
  const nav = make('nav', 'mobile-bottom-nav');
  nav.setAttribute('aria-label', 'Atalhos principais');
  const items = [
    ['home', '⌂', 'Início', 'index.html'],
    ['study', '▤', 'Estudar', 'estudar.html'],
    ['questions', '?', 'Questões', 'questoes.html'],
    ['performance', '◫', 'Desempenho', 'desempenho.html']
  ];
  for (const [id, icon, label, href] of items) {
    const link = make('a', id === pageId ? 'active' : '');
    link.href = href;
    link.innerHTML = `<span>${icon}</span><small>${label}</small>`;
    nav.append(link);
  }
  const more = make('button', 'mobile-more');
  more.type = 'button';
  more.innerHTML = '<span>☰</span><small>Mais</small>';
  if (!items.some(([id]) => id === pageId)) more.classList.add('active');
  more.addEventListener('click', () => document.querySelector('#menuButton')?.click());
  nav.append(more);
  document.body.append(nav);
}

function createBreadcrumb() {
  const page = document.querySelector('.page');
  const header = document.querySelector('.page-header');
  if (!page || !header || pageId === 'home') return;
  let breadcrumb = page.querySelector('.breadcrumb');
  if (!breadcrumb) {
    breadcrumb = make('nav', 'breadcrumb');
    breadcrumb.setAttribute('aria-label', 'Caminho da página');
    header.before(breadcrumb);
  }
  const pieces = ['<a href="index.html">Início</a>'];
  if (pageId === 'study') {
    const unitTitle = document.querySelector('.lesson-summary h2')?.textContent?.trim();
    pieces.push('<a href="materias.html">Matérias</a>');
    pieces.push(`<span>${escapeHtml(unitTitle || 'Estudo')}</span>`);
  } else {
    pieces.push(`<span>${escapeHtml(PAGE_LABELS[pageId] || 'Área')}</span>`);
  }
  breadcrumb.innerHTML = pieces.join('<b aria-hidden="true">›</b>');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function enhanceHome() {
  if (pageId !== 'home') return;
  const hero = document.querySelector('.hero-card');
  if (!hero) return;
  const pill = hero.querySelector('.status-pill');
  const title = hero.querySelector('h2');
  const description = [...hero.querySelectorAll('p')].find((node) => !node.classList.contains('status-pill'));
  if (pill) pill.textContent = 'PMDF • PMGO • PMMG — preparação integrada';
  if (title) title.textContent = 'Estude com método. Avance com constância.';
  if (description && !description.dataset.beginnerCopy) {
    const oldText = description.textContent;
    description.dataset.beginnerCopy = 'true';
    description.textContent = 'Para quem está começando, a prioridade é construir a base comum, praticar logo após a teoria e revisar os erros antes de aumentar a dificuldade.';
    if (oldText && oldText !== description.textContent) {
      const next = make('p', 'home-next-step', oldText);
      description.after(next);
    }
  }
  const actions = hero.querySelector('.button-row');
  if (actions && !actions.querySelector('[href="cronograma.html"]')) {
    const cycle = make('a', 'secondary-link', 'Ver cronograma por ciclos');
    cycle.href = 'cronograma.html';
    actions.append(cycle);
  }
  const target = document.querySelector('#pageContent');
  if (target && !target.querySelector('.learning-path-card')) {
    const card = make('section', 'card learning-path-card');
    card.innerHTML = `
      <div class="section-heading"><p class="eyebrow">Caminho do iniciante</p><h2>Uma base forte antes das específicas</h2></div>
      <div class="path-steps">
        <article><span>1</span><div><strong>Base comum</strong><p>Português e demais disciplinas compartilhadas entram primeiro, sempre com teoria + questões + revisão.</p></div></article>
        <article><span>2</span><div><strong>Consolidação</strong><p>Erros e revisões determinam o ritmo. O ciclo não avança só porque mudou o dia da semana.</p></div></article>
        <article><span>3</span><div><strong>Específicas em rotação</strong><p>Quando a base estiver madura: PMDF → PMGO → PMMG, retornando ao início da rotação.</p></div></article>
      </div>`;
    hero.after(card);
  }
  const primary = hero.querySelector('a.primary-link[href*="estudar.html"]');
  const unitId = primary ? new URL(primary.href, window.location.href).searchParams.get('unit') : null;
  if (primary && unitId) {
    const progress = readProgress(unitId);
    if (progress?.percent > 4 && progress.percent < 98) primary.textContent = `Continuar leitura (${progress.percent}%)`;
  }
}

function readerSettings() {
  try {
    return { font: 0, line: 0, width: 0, focus: false, ...JSON.parse(localStorage.getItem(READER_KEY) || '{}') };
  } catch {
    return { font: 0, line: 0, width: 0, focus: false };
  }
}

function saveReaderSettings(settings) {
  localStorage.setItem(READER_KEY, JSON.stringify(settings));
}

function applyReaderSettings(settings = readerSettings()) {
  const lesson = document.querySelector('.lesson');
  if (!lesson) return;
  lesson.style.setProperty('--reader-font-step', String(settings.font));
  lesson.style.setProperty('--reader-line-step', String(settings.line));
  lesson.style.setProperty('--reader-width-step', String(settings.width));
  document.body.classList.toggle('reader-focus', Boolean(settings.focus));
  const focusButton = document.querySelector('[data-reader-action="focus"]');
  if (focusButton) focusButton.textContent = settings.focus ? 'Sair do foco' : 'Modo foco';
}

function unitIdFromUrl() {
  return new URLSearchParams(window.location.search).get('unit') || document.querySelector('.lesson-summary h2')?.textContent?.trim() || 'current';
}

function progressKey(unitId) {
  return `${STORAGE_PREFIX}reading:${unitId}`;
}

function readProgress(unitId) {
  try { return JSON.parse(localStorage.getItem(progressKey(unitId)) || 'null'); } catch { return null; }
}

function saveReadingProgress() {
  const lesson = document.querySelector('.lesson');
  if (!lesson || pageId !== 'study') return;
  const unitId = unitIdFromUrl();
  const top = window.scrollY + lesson.getBoundingClientRect().top;
  const usable = Math.max(1, lesson.offsetHeight - Math.min(window.innerHeight * 0.5, 420));
  const ratio = Math.max(0, Math.min(1, (window.scrollY - top + 100) / usable));
  const percent = Math.round(ratio * 100);
  localStorage.setItem(progressKey(unitId), JSON.stringify({ percent, ratio, updatedAt: new Date().toISOString() }));
  const bar = document.querySelector('.reading-progress-bar');
  const label = document.querySelector('.reading-progress-label');
  if (bar) bar.style.width = `${percent}%`;
  if (label) label.textContent = `${percent}% lido`;
}

function enhanceStudy() {
  if (pageId !== 'study') return;
  const lesson = document.querySelector('.lesson');
  if (!lesson) return;
  const existingFooterLink = lesson.querySelector('.lesson-footer .primary-link');
  if (existingFooterLink) existingFooterLink.textContent = 'Fazer questões desta aula';
  const footer = lesson.querySelector('.lesson-footer');
  if (footer && !footer.querySelector('.subject-question-link')) {
    const subjectQuestions = make('a', 'secondary-link subject-question-link', 'Escolher questões por matéria');
    subjectQuestions.href = 'materias.html#questoes-por-materia';
    footer.append(subjectQuestions);
  }
  if (!document.querySelector('.reader-toolbar')) {
    const toolbar = make('section', 'reader-toolbar');
    toolbar.setAttribute('aria-label', 'Controles de leitura');
    toolbar.innerHTML = `
      <div class="reader-tools-main">
        <strong>Leitura confortável</strong>
        <button type="button" data-reader-action="font-down">A−</button>
        <button type="button" data-reader-action="font-up">A+</button>
        <button type="button" data-reader-action="line">↕ Espaçamento</button>
        <button type="button" data-reader-action="width">↔ Largura</button>
        <button type="button" data-reader-action="theme">◐ Tema</button>
        <button type="button" data-reader-action="focus">Modo foco</button>
      </div>
      <div class="reading-progress"><div class="reading-progress-track"><span class="reading-progress-bar"></span></div><small class="reading-progress-label">0% lido</small></div>`;
    lesson.before(toolbar);
    toolbar.addEventListener('click', (event) => {
      const action = event.target?.dataset?.readerAction;
      if (!action) return;
      const settings = readerSettings();
      if (action === 'font-down') settings.font = Math.max(-2, settings.font - 1);
      if (action === 'font-up') settings.font = Math.min(4, settings.font + 1);
      if (action === 'line') settings.line = (settings.line + 1) % 3;
      if (action === 'width') settings.width = (settings.width + 1) % 3;
      if (action === 'theme') cycleTheme();
      if (action === 'focus') settings.focus = !settings.focus;
      saveReaderSettings(settings);
      applyReaderSettings(settings);
    });
  }
  applyReaderSettings();
  const unitId = unitIdFromUrl();
  const saved = readProgress(unitId);
  const toolbar = document.querySelector('.reader-toolbar');
  if (saved?.percent > 5 && saved.percent < 96 && toolbar && !toolbar.querySelector('.resume-reading')) {
    const resume = make('button', 'resume-reading', `Retomar em ${saved.percent}%`);
    resume.type = 'button';
    resume.addEventListener('click', () => {
      const top = window.scrollY + lesson.getBoundingClientRect().top;
      const usable = Math.max(1, lesson.offsetHeight - Math.min(window.innerHeight * 0.5, 420));
      window.scrollTo({ top: Math.max(0, top + usable * saved.ratio - 90), behavior: 'smooth' });
    });
    toolbar.querySelector('.reader-tools-main')?.append(resume);
  }
  saveReadingProgress();
  if (!state.readerScrollBound) {
    state.readerScrollBound = true;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        saveReadingProgress();
        ticking = false;
      });
    }, { passive: true });
  }
}

async function enhanceSubjects() {
  if (pageId !== 'subjects') return;
  const grid = document.querySelector('.subject-grid');
  if (!grid) return;
  grid.id = 'questoes-por-materia';
  const catalog = await loadCatalog();
  if (!catalog) return;
  for (const card of grid.querySelectorAll('.subject-card')) {
    if (card.querySelector('.subject-practice-action')) continue;
    const title = card.querySelector('h2')?.textContent?.trim();
    const subject = (catalog.subjects ?? []).find((item) => item.name === title);
    if (!subject) continue;
    card.id = subject.id;
    const actions = make('div', 'button-row subject-actions');
    const practice = make('a', 'secondary-link subject-practice-action', 'Resolver questões desta matéria');
    practice.href = `questoes.html?subject=${encodeURIComponent(subject.id)}`;
    actions.append(practice);
    card.append(actions);
  }
}

function buildSubjectSelector(catalog, selectedId = '') {
  const section = make('section', 'card subject-selector');
  section.innerHTML = '<div><p class="eyebrow">Prática por matéria</p><h2>Escolha a matéria que quer treinar</h2><p>Para manter o estudo guiado, você escolhe a matéria e depois a unidade. Assim o iniciante não mistura conteúdos que ainda não estudou.</p></div>';
  const form = make('form', 'subject-selector-form');
  const select = make('select', 'subject-select');
  select.setAttribute('aria-label', 'Escolher matéria para questões');
  select.append(new Option('Selecione uma matéria…', ''));
  for (const subject of [...(catalog.subjects ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const option = new Option(subject.name, subject.id, false, subject.id === selectedId);
    select.append(option);
  }
  const button = make('button', '', 'Ver questões');
  button.type = 'submit';
  form.append(select, button);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!select.value) return;
    window.location.href = `questoes.html?subject=${encodeURIComponent(select.value)}`;
  });
  section.append(form);
  return section;
}

async function enhanceQuestions() {
  if (pageId !== 'questions') return;
  const target = document.querySelector('#pageContent');
  if (!target) return;
  const catalog = await loadCatalog();
  if (!catalog) return;
  const params = new URLSearchParams(window.location.search);
  const subjectId = params.get('subject');
  const unitId = params.get('unit');
  if (subjectId && !unitId) {
    const subject = (catalog.subjects ?? []).find((item) => item.id === subjectId);
    if (!subject) return;
    if (!target.querySelector('.subject-question-picker')) {
      const units = (catalog.units ?? []).filter((unit) => unit.subjectId === subjectId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const total = units.reduce((sum, unit) => sum + (unit.questionIds?.length ?? 0), 0);
      const picker = make('section', 'card subject-question-picker');
      const intro = make('div', 'section-heading');
      intro.innerHTML = `<p class="eyebrow">Questões por matéria</p><h2>${escapeHtml(subject.name)}</h2><p>${total} questão(ões) publicadas em ${units.length} unidade(s). Escolha uma unidade para praticar sem pular a sequência pedagógica.</p>`;
      picker.append(intro);
      const list = make('div', 'subject-unit-list');
      for (const unit of units) {
        const row = make('article', 'subject-unit-row');
        const copy = make('div');
        copy.append(make('strong', '', unit.title), make('small', '', `${unit.questionIds?.length ?? 0} questão(ões) · ${unit.stage ?? 'Etapa'}`));
        const link = make('a', 'primary-link', 'Praticar');
        link.href = `questoes.html?subject=${encodeURIComponent(subjectId)}&unit=${encodeURIComponent(unit.id)}`;
        row.append(copy, link);
        list.append(row);
      }
      if (!units.length) list.append(make('p', 'search-hint', 'Ainda não há unidades publicadas para esta matéria.'));
      picker.append(list);
      const back = make('a', 'secondary-link', 'Trocar matéria');
      back.href = 'questoes.html';
      picker.append(back);
      target.replaceChildren(picker);
      const title = document.querySelector('.page-header h1');
      const description = document.querySelector('.page-header p:last-child');
      if (title) title.textContent = `Questões — ${subject.name}`;
      if (description) description.textContent = 'Escolha a unidade que corresponde ao ponto atual do seu ciclo de estudos.';
    }
    return;
  }
  if (!target.querySelector('.subject-selector')) {
    target.prepend(buildSubjectSelector(catalog, subjectId || ''));
  }
}

async function renderSchedule() {
  if (pageId !== 'schedule') return;
  const target = document.querySelector('#pageContent');
  if (!target || target.querySelector('.cycle-page')) return;
  const headerTitle = document.querySelector('.page-header h1');
  const headerDescription = document.querySelector('.page-header p:last-child');
  const eyebrow = document.querySelector('.page-header .eyebrow');
  if (eyebrow) eyebrow.textContent = 'Plano de estudos';
  if (headerTitle) headerTitle.textContent = 'Cronograma por ciclos';
  if (headerDescription) headerDescription.textContent = 'Sem calendário fixo: conclua o item do ciclo, registre a prática e continue do ponto em que parou.';
  const actions = document.querySelector('#pageActions');
  if (actions) actions.innerHTML = '<span class="status-pill">Sem datas fixas</span>';
  const catalog = await loadCatalog();
  const wrap = make('div', 'cycle-page');
  const hero = make('section', 'cycle-hero');
  hero.innerHTML = `
    <p class="status-pill">Estrutura definida · distribuição final em preparação</p>
    <h2>Primeiro o que é comum. Depois, específicas em rotação.</h2>
    <p>O ciclo definitivo será fechado quando o mapa curricular e o acervo de teoria + questões estiverem suficientemente completos para definir pesos sem adivinhação. A estrutura, porém, já pode existir agora e orientar o iniciante desde o primeiro conteúdo.</p>`;
  wrap.append(hero);

  const phases = make('section', 'cycle-grid');
  phases.innerHTML = `
    <article class="cycle-card active"><span class="cycle-number">1</span><div><p class="eyebrow">Fase inicial</p><h3>Base comum</h3><p>Priorizar disciplinas compartilhadas. Cada item segue teoria → questões → revisão. O aluno só aumenta a complexidade depois de construir compreensão mínima.</p></div></article>
    <article class="cycle-card"><span class="cycle-number">2</span><div><p class="eyebrow">Consolidação</p><h3>Erros comandam a revisão</h3><p>Caderno de erros e revisões entram no próprio ciclo. Não há “segunda-feira de Português”: há o próximo item ainda não concluído.</p></div></article>
    <article class="cycle-card"><span class="cycle-number">3</span><div><p class="eyebrow">Depois da base</p><h3>Específicas em rotação</h3><p>PMDF → PMGO → PMMG → repetir. A rotação impede abandonar uma corporação e mantém o projeto focado nos três concursos definidos.</p></div></article>`;
  wrap.append(phases);

  const beginner = make('section', 'card cycle-rule-card');
  beginner.innerHTML = `
    <p class="eyebrow">Regra para iniciante</p>
    <h2>O ciclo acompanha o aprendizado, não o calendário</h2>
    <div class="cycle-rules">
      <p><strong>Se não concluiu:</strong> retome do mesmo ponto na próxima sessão.</p>
      <p><strong>Se errou muito:</strong> revisão e refação entram antes do próximo salto.</p>
      <p><strong>Se concluiu bem:</strong> avance para o próximo item do ciclo.</p>
    </div>`;
  wrap.append(beginner);

  if (catalog) {
    const available = make('section', 'card published-cycle-content');
    available.innerHTML = '<p class="eyebrow">Acervo publicado</p><h2>Conteúdo que já alimenta a construção da base</h2><p>Esta lista é informativa. A classificação final entre “comum” e “específica” será validada quando a matriz PMDF × PMGO × PMMG estiver completa.</p>';
    const grid = make('div', 'published-subjects');
    for (const subject of [...(catalog.subjects ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
      const count = (catalog.units ?? []).filter((unit) => unit.subjectId === subject.id).length;
      if (!count) continue;
      const item = make('a', 'published-subject');
      item.href = `materias.html#${encodeURIComponent(subject.id)}`;
      item.append(make('strong', '', subject.name), make('small', '', `${count} unidade(s) publicada(s)`));
      grid.append(item);
    }
    available.append(grid);
    wrap.append(available);
  }

  const decision = make('section', 'card schedule-decision');
  decision.innerHTML = `
    <p class="eyebrow">Quando fechar o ciclo definitivo?</p>
    <h2>Depois do mapa curricular completo — não necessariamente depois da última questão existir</h2>
    <p>Precisamos conhecer todas as disciplinas, separar o núcleo comum das específicas e ter conteúdo suficiente para estimar volume e dificuldade. Esperar 100% de todas as questões atrasaria o uso; fechar pesos cedo demais criaria um ciclo artificial. O ponto certo é: estrutura agora, calibração progressiva e versão definitiva após a cobertura editorial dos três concursos.</p>`;
  wrap.append(decision);
  target.replaceChildren(wrap);
}

function enhancePerformance() {
  if (pageId !== 'performance') return;
  const target = document.querySelector('#pageContent');
  if (!target || target.querySelector('.performance-guidance')) return;
  const card = make('section', 'card performance-guidance');
  card.innerHTML = '<p class="eyebrow">Como usar estes números</p><h2>Desempenho serve para escolher a próxima revisão</h2><p>Para um iniciante, volume sozinho engana. Priorize revisões pendentes e erros recorrentes antes de tentar aumentar a quantidade diária de questões.</p>';
  target.append(card);
}

function installFooter() {
  const page = document.querySelector('.page');
  if (!page || page.querySelector('.app-footer')) return;
  const footer = make('footer', 'app-footer');
  footer.innerHTML = `
    <div><strong>Mychael PM</strong><span>PMDF · PMGO · PMMG</span></div>
    <div class="footer-status"><span class="live-clock">${formatLongClock()}</span><span class="sync-status">Verificando última sincronização…</span></div>`;
  page.append(footer);
  const updateClock = () => {
    const node = footer.querySelector('.live-clock');
    if (node) node.textContent = formatLongClock();
  };
  updateClock();
  setInterval(updateClock, 60_000);
  updateSyncStatus(footer.querySelector('.sync-status'));
}

async function updateSyncStatus(node) {
  if (!node) return;
  const [deployment, catalog] = await Promise.all([loadDeployment(), loadCatalog()]);
  const meta = deployment.data;
  if (deployment.source === 'deployment' && meta?.deployedAt) {
    const version = meta.contentVersion ?? catalog?.contentVersion ?? '?';
    const lot = meta.lotId ? ` · ${meta.lotId}` : '';
    node.textContent = `● Última sincronização: ${formatDateTime(meta.deployedAt)} · conteúdo v${version}${lot}`;
    node.dataset.state = 'ok';
    return;
  }
  const fallbackDate = catalog?.generatedAt || meta?.generatedAt;
  if (fallbackDate) {
    const mismatch = meta?.contentVersion && catalog?.contentVersion && meta.contentVersion !== catalog.contentVersion;
    if (mismatch) {
      node.textContent = `● Conteúdo v${catalog.contentVersion} publicado · metadados de deploy serão atualizados na próxima publicação`;
      node.dataset.state = 'warning';
    } else {
      node.textContent = `● Conteúdo gerado em ${formatDateTime(fallbackDate)} · sincronização final confirmada no próximo deploy`;
      node.dataset.state = 'warning';
    }
    return;
  }
  node.textContent = '● Horário da última sincronização indisponível';
  node.dataset.state = 'warning';
}

function queueRefresh() {
  if (state.refreshQueued) return;
  state.refreshQueued = true;
  requestAnimationFrame(async () => {
    state.refreshQueued = false;
    enhanceBrand();
    rebuildNavigation();
    createUtilityPanel();
    createMobileBottomNav();
    createBreadcrumb();
    enhanceHome();
    enhanceStudy();
    await enhanceSubjects();
    await enhanceQuestions();
    await renderSchedule();
    enhancePerformance();
    installFooter();
  });
}

function startObserver() {
  const observer = new MutationObserver(queueRefresh);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueRefresh();
}

injectStyles();
applyTheme(preferredTheme());
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
else startObserver();
