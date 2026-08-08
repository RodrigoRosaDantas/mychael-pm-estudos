const DATA_URL = './content/taf-pmmg-historical.json';

let dataPromise = null;

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = options.text;
  return node;
}

async function loadReferences() {
  if (!dataPromise) {
    dataPromise = fetch(DATA_URL, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`TAF histórico indisponível (${response.status}).`);
        const payload = await response.json();
        if (!Array.isArray(payload.records)) throw new Error('Formato de TAF histórico inválido.');
        return payload;
      })
      .catch((error) => {
        console.error(error);
        return {
          scope: 'PMMG',
          temporalStatus: 'Histórico',
          currentIndexAvailable: false,
          autoApplicableNextEdital: false,
          records: [],
          loadError: true
        };
      });
  }
  return dataPromise;
}

function referenceCard(record) {
  const row = el('article', { className: 'taf-reference-item' });
  const copy = el('div');
  copy.append(
    el('p', { className: 'eyebrow', text: `${record.sex} · ${record.test}` }),
    el('h3', { text: record.criterion })
  );

  const tags = el('div', { className: 'tag-row' });
  tags.append(
    el('span', { text: 'Histórico' }),
    el('span', { text: 'Não é índice vigente' })
  );
  copy.append(tags);

  if (record.scale) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Ver escala histórica';
    details.append(summary, el('p', { className: 'taf-notes', text: record.scale }));
    copy.append(details);
  }

  row.append(copy);
  return row;
}

function referencesSection(payload) {
  const section = el('section', { className: 'card taf-history' });
  section.dataset.tafHistoricalReferences = 'true';
  section.append(
    el('p', { className: 'eyebrow', text: 'Referência histórica · PMMG' }),
    el('h2', { text: 'AFM/TCF do CFSd QP-PM/2025' }),
    el('p', {
      text: 'Estes dados reproduzem a referência histórica auditada do Edital DRH/CRS nº 10/2024. Não são índices vigentes e não devem ser aplicados automaticamente a um futuro concurso.'
    })
  );

  const source = el('p', {
    className: 'taf-notes',
    text: 'Fonte editorial: FNT-0025 — cópia integral secundária auditada. A existência da etapa física no certame é corroborada institucionalmente, mas a cópia usada para os índices não é rotulada como arquivo oficial hospedado pela PMMG.'
  });
  section.append(source);

  if (payload.loadError) {
    section.append(el('p', {
      className: 'taf-empty',
      text: 'A referência histórica não pôde ser carregada agora. Nenhum índice vigente foi presumido.'
    }));
    return section;
  }

  const list = el('div', { className: 'taf-history-list' });
  for (const record of payload.records) list.append(referenceCard(record));
  section.append(list);
  return section;
}

function inject(payload) {
  const root = document.querySelector('[data-taf-module="true"]');
  if (!root || root.querySelector('[data-taf-historical-references="true"]')) return;

  const section = referencesSection(payload);
  const truth = root.querySelector('.taf-truth');
  if (truth) truth.after(section);
  else root.prepend(section);
}

async function bootHistoricalReferences() {
  if (document.body.dataset.page !== 'taf') return;
  const payload = await loadReferences();
  inject(payload);

  const observer = new MutationObserver(() => inject(payload));
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

bootHistoricalReferences();
