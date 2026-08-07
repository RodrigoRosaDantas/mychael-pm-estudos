const MATRIX_URL = './content/curriculum-matrix.json';

const SHORT_NAMES = Object.freeze({
  'PMDF-SOLDADO': 'PMDF',
  'PMGO-SOLDADO': 'PMGO',
  'PMMG-SOLDADO': 'PMMG'
});

const CLASS_LABELS = Object.freeze({
  'common-3': 'Comum aos 3',
  'overlap-3-topic-level': 'Comum por tópicos',
  'common-2': 'Compartilhada por 2',
  'common-2-explicit': 'Compartilhada por 2',
  'parallel-local': 'Regional paralela',
  'specific-pmdf': 'Específica PMDF',
  'specific-pmmg': 'Específica PMMG',
  'specific-pmmg-topic': 'Tópico PMMG',
  'specific-pmgo-discipline-overlap-pmdf-topics': 'Disciplina PMGO'
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function percent(value) {
  if (typeof value !== 'number') return null;
  return `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function coverageText(coverage) {
  if (!coverage?.present) return '<span class="matrix-no">—</span>';
  const share = percent(coverage.objectivePointShare);
  const detail = share ? `<small>${share} da objetiva</small>` : coverage.withinBlock ? '<small>peso interno não separado</small>' : '';
  return `<span class="matrix-yes">✓</span>${detail}`;
}

function sourceBadge(competition) {
  if (competition.referenceStatus === 'official-current-reference') return 'Referência oficial';
  return 'Referência mais recente localizada';
}

function competitionCard(competition) {
  const exam = competition.exam;
  const essay = exam.essayPoints ? ` + redação ${exam.essayPoints} pts` : '';
  return `
    <article class="matrix-competition-card">
      <div class="matrix-card-top"><strong>${escapeHtml(SHORT_NAMES[competition.id])}</strong><span>${escapeHtml(sourceBadge(competition))}</span></div>
      <h3>${escapeHtml(competition.referenceNotice)}</h3>
      <p>${exam.objectiveQuestions} questões · ${exam.objectivePoints} pts objetiva${essay}</p>
      <small>${escapeHtml(competition.currentState)}</small>
    </article>`;
}

function matrixRow(discipline) {
  const cells = ['PMDF-SOLDADO', 'PMGO-SOLDADO', 'PMMG-SOLDADO']
    .map((id) => `<td>${coverageText(discipline.coverage[id])}</td>`)
    .join('');
  return `
    <tr data-matrix-class="${escapeHtml(discipline.classification)}">
      <th scope="row"><strong>${escapeHtml(discipline.canonicalName)}</strong><small>${escapeHtml(CLASS_LABELS[discipline.classification] || discipline.classification)}</small></th>
      ${cells}
    </tr>`;
}

function commonTopics(matrix) {
  const topics = matrix.verifiedTopicOverlaps.filter((topic) => topic.competitions.length === 3);
  return topics.map((topic) => `<li><span>✓</span><div><strong>${escapeHtml(topic.label)}</strong><small>PMDF · PMGO · PMMG</small></div></li>`).join('');
}

function filtersMarkup() {
  return `
    <div class="matrix-filters" role="group" aria-label="Filtrar matriz curricular">
      <button type="button" class="active" data-matrix-filter="all">Tudo</button>
      <button type="button" data-matrix-filter="common">Comuns</button>
      <button type="button" data-matrix-filter="specific">Específicas</button>
    </div>`;
}

function applyFilter(panel, filter) {
  const rows = panel.querySelectorAll('tbody tr');
  for (const row of rows) {
    const kind = row.dataset.matrixClass || '';
    const isCommon = kind.startsWith('common') || kind.startsWith('overlap') || kind === 'parallel-local';
    const show = filter === 'all' || (filter === 'common' && isCommon) || (filter === 'specific' && !isCommon);
    row.hidden = !show;
  }
  for (const button of panel.querySelectorAll('[data-matrix-filter]')) {
    button.classList.toggle('active', button.dataset.matrixFilter === filter);
  }
}

function buildPanel(matrix) {
  const section = document.createElement('section');
  section.className = 'card curriculum-matrix-panel';
  section.id = 'matriz-concursos';
  section.innerHTML = `
    <div class="matrix-heading">
      <div>
        <p class="eyebrow">Matriz curricular validada</p>
        <h2>O que realmente se repete entre PMDF, PMGO e PMMG</h2>
        <p>O cruzamento usa os editais de referência e separa disciplina idêntica de mera sobreposição temática. Isso evita estudar Penal para a PMMG só porque existe um bloco chamado “Noções de Direito”.</p>
      </div>
      <span class="status-pill">Revisada em 07/08/2026</span>
    </div>
    <div class="matrix-competition-grid">${matrix.competitions.map(competitionCard).join('')}</div>
    <div class="matrix-common-core">
      <div>
        <p class="eyebrow">Fase 1 do ciclo</p>
        <h3>Núcleo comum aos três</h3>
        <p><strong>Português</strong> é a única disciplina autônoma presente nos três. Em Direito Constitucional, há um núcleo temático comum comprovado, mas os blocos têm formatos diferentes.</p>
      </div>
      <ul>${commonTopics(matrix)}</ul>
    </div>
    <div class="matrix-table-heading">
      <div><p class="eyebrow">Comparação disciplinar</p><h3>Matriz de incidência</h3></div>
      ${filtersMarkup()}
    </div>
    <div class="matrix-table-wrap">
      <table class="curriculum-table">
        <thead><tr><th>Disciplina / família</th><th>PMDF</th><th>PMGO</th><th>PMMG</th></tr></thead>
        <tbody>${matrix.disciplines.map(matrixRow).join('')}</tbody>
      </table>
    </div>
    <aside class="matrix-warning">
      <strong>Como isso entra no cronograma?</strong>
      <p>Os percentuais acima descrevem a prova de referência, não a quantidade automática de horas. O peso definitivo do ciclo continua pendente até cruzarmos esta matriz com a cobertura de teoria, questões, erros e revisões do estudante.</p>
    </aside>
  `;
  section.addEventListener('click', (event) => {
    const button = event.target.closest('[data-matrix-filter]');
    if (button) applyFilter(section, button.dataset.matrixFilter);
  });
  return section;
}

async function loadMatrix() {
  const response = await fetch(MATRIX_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Matriz curricular indisponível (${response.status}).`);
  return response.json();
}

async function mount() {
  if (document.body.dataset.page !== 'schedule' || document.querySelector('.curriculum-matrix-panel')) return;
  const cyclePage = document.querySelector('.cycle-page');
  if (!cyclePage) return;
  try {
    const matrix = await loadMatrix();
    const panel = buildPanel(matrix);
    const decision = cyclePage.querySelector('.schedule-decision');
    if (decision) decision.before(panel);
    else cyclePage.append(panel);
  } catch (error) {
    console.warn('Matriz curricular:', error);
  }
}

const observer = new MutationObserver(() => mount());
observer.observe(document.documentElement, { childList: true, subtree: true });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
