const DATA_URL = './content/exams-history.json';

let dataPromise = null;
let rendering = false;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function formatDate(value) {
  const [year, month, day] = String(value ?? '').split('-').map(Number);
  if (!year || !month || !day) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function loadData() {
  if (!dataPromise) {
    dataPromise = fetch(DATA_URL, { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error(`Falha ao carregar o acervo histórico (${response.status}).`);
      const data = await response.json();
      if (data.publicationStatus !== 'published' || data.scope !== 'historical-metadata-only') {
        throw new Error('O acervo histórico ainda não está liberado para exibição pública.');
      }
      return data;
    });
  }
  return dataPromise;
}

function definition(term, value) {
  const fragment = document.createDocumentFragment();
  fragment.append(node('dt', '', term), node('dd', '', value));
  return fragment;
}

function examCard(exam) {
  const card = node('article', 'card');
  const heading = node('div', 'section-heading');
  const titleWrap = node('div');
  titleWrap.append(node('p', 'eyebrow', exam.corporation), node('h2', '', exam.title));
  heading.append(titleWrap, node('span', 'status-pill', exam.availability));

  const details = node('dl', 'definition-list');
  details.append(
    definition('Aplicação', formatDate(exam.applicationDate)),
    definition('Questões objetivas', String(exam.questions)),
    definition('Redação', exam.essay ? 'Sim' : 'Não')
  );

  const status = node('div', 'feedback');
  status.append(node('strong', '', 'Situação documental'), node('p', '', exam.documentStatus));

  const links = node('div', 'question-actions');
  for (const source of exam.officialLinks ?? []) {
    const link = node('a', 'primary-link', source.label);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    links.append(link);
  }

  card.append(heading, details, status);
  if (links.childElementCount) card.append(links);
  return card;
}

async function renderExamHistory(target) {
  if (rendering || target.dataset.examHistoryRendered === 'true') return;
  rendering = true;
  try {
    const data = await loadData();
    const intro = node('section', 'card warning-card');
    intro.append(node('h2', '', 'Acervo histórico'), node('p', '', data.notice));

    const list = node('div', 'page-content');
    for (const exam of data.exams ?? []) list.append(examCard(exam));

    target.replaceChildren(intro, list);
    target.dataset.examHistoryRendered = 'true';

    const status = document.querySelector('#pageStatus');
    if (status) status.textContent = `${data.exams?.length ?? 0} provas históricas catalogadas.`;
  } catch (error) {
    console.error(error);
    const card = node('section', 'card empty-card');
    card.append(node('h2', '', 'Acervo temporariamente indisponível'), node('p', '', 'Não foi possível carregar os metadados históricos. Atualize a página e tente novamente.'));
    target.replaceChildren(card);
  } finally {
    rendering = false;
  }
}

function shouldRender(target) {
  return document.body.dataset.page === 'exams'
    && target
    && target.dataset.examHistoryRendered !== 'true'
    && target.querySelector('.empty-card');
}

function bind() {
  if (document.body.dataset.page !== 'exams') return;
  const target = document.querySelector('#pageContent');
  if (!target) {
    requestAnimationFrame(bind);
    return;
  }

  const observer = new MutationObserver(() => {
    if (shouldRender(target)) renderExamHistory(target);
  });
  observer.observe(target, { childList: true, subtree: true });
  if (shouldRender(target)) renderExamHistory(target);
}

bind();
