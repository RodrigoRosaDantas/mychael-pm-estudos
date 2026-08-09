import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';
import {
  computeCompetitionProgress,
  nextGuidedStep,
  resolveUnitApplicability
} from './applicability-core.js';

const pageId = document.body.dataset.page || 'home';
const CATALOG_URL = './content/catalog.json';
const APPLICABILITY_URL = './content/content-applicability.json';
const STYLE_URL = './assets/competition-progress.css';
const COMPETITION_LABELS = Object.freeze({ PMDF: 'PMDF', PMGO: 'PMGO', PMMG: 'PMMG' });

const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

const state = {
  publicPromise: null,
  privatePromise: null,
  observer: null,
  queued: false
};

function injectStyles() {
  if (document.querySelector('link[data-competition-progress]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL;
  link.dataset.competitionProgress = 'true';
  document.head.append(link);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function publicData() {
  if (!state.publicPromise) {
    state.publicPromise = Promise.all([
      fetch(CATALOG_URL, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('Catálogo indisponível.');
        return response.json();
      }),
      fetch(APPLICABILITY_URL, { cache: 'no-store' }).then((response) => {
        if (!response.ok) throw new Error('Camada de aplicabilidade indisponível.');
        return response.json();
      })
    ]).then(([catalog, applicability]) => ({ catalog, applicability }));
  }
  return state.publicPromise;
}

function privateData() {
  if (!state.privatePromise) {
    state.privatePromise = (async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.user) {
          return { authenticated: false, studyUnits: [], attempts: [], openErrorQuestionIds: [] };
        }
        const { data: profile, error: profileError } = await supabase
          .from('student_profiles')
          .select('id, status')
          .eq('id', supabaseConfig.profileId)
          .maybeSingle();
        if (profileError || profile?.status !== 'active') {
          return { authenticated: false, studyUnits: [], attempts: [], openErrorQuestionIds: [] };
        }

        const [unitsResult, attemptsResult, errorsResult] = await Promise.all([
          supabase
            .from('study_units')
            .select('unit_id, status, mastery_percent, last_activity_at')
            .eq('profile_id', supabaseConfig.profileId),
          supabase
            .from('question_attempts')
            .select('question_id, is_correct, answered_at')
            .eq('profile_id', supabaseConfig.profileId),
          supabase
            .from('error_items')
            .select('question_id, status')
            .eq('profile_id', supabaseConfig.profileId)
            .in('status', ['open', 'reviewing'])
        ]);
        if (unitsResult.error || attemptsResult.error || errorsResult.error) {
          console.warn('Competition progress: dados privados indisponíveis.', unitsResult.error || attemptsResult.error || errorsResult.error);
          return { authenticated: true, studyUnits: [], attempts: [], openErrorQuestionIds: [], degraded: true };
        }
        return {
          authenticated: true,
          studyUnits: unitsResult.data ?? [],
          attempts: attemptsResult.data ?? [],
          openErrorQuestionIds: [...new Set((errorsResult.data ?? []).map((row) => row.question_id).filter(Boolean))],
          degraded: false
        };
      } catch (error) {
        console.warn('Competition progress: falha ao consultar progresso.', error);
        return { authenticated: false, studyUnits: [], attempts: [], openErrorQuestionIds: [], degraded: true };
      }
    })();
  }
  return state.privatePromise;
}

function progressCard(scope) {
  const accuracy = scope.accuracyPercent == null ? 'sem questões respondidas' : `${scope.accuracyPercent}% de acerto`;
  const mastery = scope.averageMastery == null ? '' : `<span>Domínio médio: <strong>${scope.averageMastery}%</strong></span>`;
  return `
    <article class="competition-progress-card" data-scope="${escapeHtml(scope.id)}">
      <div class="competition-progress-card__head">
        <strong>${escapeHtml(scope.label)}</strong>
        <span>${scope.studyPercent}%</span>
      </div>
      <div class="competition-progress-track" role="progressbar" aria-label="Progresso em ${escapeHtml(scope.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${scope.studyPercent}">
        <span style="width:${scope.studyPercent}%"></span>
      </div>
      <p>${scope.completedUnits} de ${scope.availableUnits} unidade(s) publicada(s) concluída(s)</p>
      <div class="competition-progress-meta">
        <span>${escapeHtml(accuracy)}</span>
        ${mastery}
      </div>
    </article>`;
}

function progressGrid(model) {
  return `<div class="competition-progress-grid">${model.scopes.map(progressCard).join('')}</div>`;
}

function progressDisclaimer(model) {
  const pending = model.pendingClassificationUnits.length;
  const correction = model.blockedUnitIds?.length
    ? ` ${model.blockedUnitIds.length} unidade(s) com erro aberto não contam como concluídas até a correção.`
    : '';
  return `
    <div class="competition-progress-disclaimer">
      <strong>Como ler estes percentuais</strong>
      <p>Os números medem somente o <b>acervo publicado e validado que já foi classificado como aplicável</b>. Eles não representam percentual do edital completo. ${pending ? `${pending} unidade(s) publicada(s) ainda aguardam classificação explícita.` : 'Todas as unidades publicadas estão classificadas nesta camada.'}${correction}</p>
    </div>`;
}

function insertAfter(reference, node) {
  if (!reference?.parentNode) return;
  reference.parentNode.insertBefore(node, reference.nextSibling);
}

async function renderPerformancePanel() {
  if (pageId !== 'performance' || document.querySelector('#competitionProgressPanel')) return;
  const target = document.querySelector('#pageContent');
  if (!target?.children.length) return;
  const [{ catalog, applicability }, privateProgress] = await Promise.all([publicData(), privateData()]);
  if (!privateProgress.authenticated) return;
  if (document.querySelector('#competitionProgressPanel')) return;

  const model = computeCompetitionProgress({
    catalog,
    applicability,
    studyUnits: privateProgress.studyUnits,
    attempts: privateProgress.attempts,
    openErrorQuestionIds: privateProgress.openErrorQuestionIds
  });
  const section = document.createElement('section');
  section.className = 'card competition-progress-panel';
  section.id = 'competitionProgressPanel';
  section.innerHTML = `
    <div class="competition-progress-heading">
      <div>
        <p class="eyebrow">Visão multi-concurso</p>
        <h2>Progresso no acervo por foco</h2>
        <p>O mesmo estudo pode avançar mais de um concurso sem duplicar teoria ou questões.</p>
      </div>
      <span class="status-pill">PMDF · PMGO · PMMG</span>
    </div>
    ${progressGrid(model)}
    ${progressDisclaimer(model)}
  `;
  const firstSection = target.querySelector('section');
  if (firstSection) insertAfter(firstSection, section);
  else target.prepend(section);
}

function guidedStepMarkup(step, authenticated) {
  if (!authenticated) {
    return `
      <div class="guided-step-copy">
        <p class="eyebrow">Próximo passo automático</p>
        <h2>O ciclo acompanha o que foi concluído</h2>
        <p>Ao entrar na plataforma, esta área identifica a primeira unidade ainda pendente do núcleo comum e só depois avança para convergências e específicas.</p>
      </div>`;
  }
  if (!step.unit) {
    return `
      <div class="guided-step-copy">
        <p class="eyebrow">${escapeHtml(step.phaseLabel)}</p>
        <h2>O próximo avanço depende do acervo editorial</h2>
        <p>${escapeHtml(step.message)}</p>
      </div>`;
  }
  if (step.phase === 'correction') {
    return `
      <div class="guided-step-copy" data-phase="correction">
        <p class="eyebrow">${escapeHtml(step.phaseLabel)}</p>
        <h2>${escapeHtml(step.unit.title)}</h2>
        <p>${escapeHtml(step.message)}</p>
        <div class="guided-step-actions">
          <a class="primary-link" href="questoes.html?unit=${encodeURIComponent(step.unit.id)}&mode=errors">Corrigir erros pendentes</a>
          <a class="secondary-link" href="estudar.html?unit=${encodeURIComponent(step.unit.id)}">Rever teoria</a>
        </div>
      </div>`;
  }
  return `
    <div class="guided-step-copy">
      <p class="eyebrow">${escapeHtml(step.phaseLabel)}</p>
      <h2>${escapeHtml(step.unit.title)}</h2>
      <p>${escapeHtml(step.message)}</p>
      <div class="guided-step-actions">
        <a class="primary-link" href="estudar.html?unit=${encodeURIComponent(step.unit.id)}">Continuar esta unidade</a>
        <a class="secondary-link" href="questoes.html?unit=${encodeURIComponent(step.unit.id)}">Questões da unidade</a>
      </div>
    </div>`;
}

async function renderScheduleProgress() {
  if (pageId !== 'schedule' || document.querySelector('#guidedCycleProgress')) return;
  const target = document.querySelector('#pageContent');
  if (!target?.children.length) return;
  const [{ catalog, applicability }, privateProgress] = await Promise.all([publicData(), privateData()]);
  if (document.querySelector('#guidedCycleProgress')) return;
  const model = computeCompetitionProgress({
    catalog,
    applicability,
    studyUnits: privateProgress.studyUnits,
    attempts: privateProgress.attempts,
    openErrorQuestionIds: privateProgress.openErrorQuestionIds
  });
  const step = nextGuidedStep({
    catalog,
    applicability,
    studyUnits: privateProgress.studyUnits,
    openErrorQuestionIds: privateProgress.openErrorQuestionIds
  });
  const section = document.createElement('section');
  section.className = 'card guided-cycle-progress';
  section.id = 'guidedCycleProgress';
  section.innerHTML = `
    <div class="guided-cycle-layout">
      ${guidedStepMarkup(step, privateProgress.authenticated)}
      <div class="guided-cycle-status">
        <strong>Regra do ciclo</strong>
        <span>1. aprender e praticar</span>
        <span>2. corrigir e revisar pendências</span>
        <span>3. avançar: comum → compartilhado → específicas</span>
      </div>
    </div>
    ${privateProgress.authenticated ? progressGrid(model) : ''}
    ${progressDisclaimer(model)}
  `;
  const hero = target.querySelector('.cycle-hero');
  if (hero) insertAfter(hero, section);
  else target.prepend(section);
}

function coverageBadges(rule) {
  const parts = [];
  for (const competition of ['PMDF', 'PMGO', 'PMMG']) {
    const active = rule.competitions.includes(competition);
    const pendingPmmg = competition === 'PMMG' && rule.status === 'pmmg-topic-review-needed';
    const className = active ? 'coverage-badge active' : pendingPmmg ? 'coverage-badge pending' : 'coverage-badge inactive';
    const suffix = pendingPmmg ? ' · validar' : '';
    const accessibleStatus = active ? 'aplica-se' : pendingPmmg ? 'aguarda validação' : 'não se aplica';
    parts.push(`<span class="${className}" aria-label="${COMPETITION_LABELS[competition]}: ${accessibleStatus}">${COMPETITION_LABELS[competition]}${suffix}</span>`);
  }
  return parts.join('');
}

function classificationLabel(rule) {
  if (rule.classification === 'common-3') return 'Núcleo comum aos três';
  if (rule.classification === 'shared-2') return 'Compartilhada por dois concursos';
  if (rule.classification === 'specific' || rule.classification === 'specific-rotation') return 'Específica de uma corporação';
  return 'Aplicabilidade em revisão';
}

async function annotateStudy() {
  if (pageId !== 'study' || document.querySelector('#unitApplicabilityStrip')) return;
  const summary = document.querySelector('.lesson-summary');
  if (!summary) return;
  const { catalog, applicability } = await publicData();
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('unit');
  const unit = (catalog.units ?? []).find((item) => item.id === requested)
    ?? [...(catalog.units ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  if (!unit || document.querySelector('#unitApplicabilityStrip')) return;
  const rule = resolveUnitApplicability(applicability, unit);
  const strip = document.createElement('div');
  strip.className = 'unit-applicability-strip';
  strip.id = 'unitApplicabilityStrip';
  strip.innerHTML = `
    <div>
      <strong>${escapeHtml(classificationLabel(rule))}</strong>
      <span>${escapeHtml(rule.note ?? 'Aplicabilidade validada pela matriz curricular.')}</span>
    </div>
    <div class="coverage-badges" aria-label="Aplicabilidade por concurso">${coverageBadges(rule)}</div>
  `;
  summary.append(strip);
}

async function annotateSubjects() {
  if (pageId !== 'subjects') return;
  const links = [...document.querySelectorAll('.unit-link')];
  if (!links.length) return;
  const { catalog, applicability } = await publicData();
  const unitMap = new Map((catalog.units ?? []).map((unit) => [unit.id, unit]));
  for (const link of links) {
    if (link.querySelector('.unit-coverage-badges')) continue;
    const url = new URL(link.href, window.location.href);
    const unit = unitMap.get(url.searchParams.get('unit'));
    if (!unit) continue;
    const rule = resolveUnitApplicability(applicability, unit);
    const badges = document.createElement('span');
    badges.className = 'unit-coverage-badges';
    badges.innerHTML = coverageBadges(rule);
    link.append(badges);
  }
}

async function refresh() {
  state.queued = false;
  try {
    await Promise.all([
      renderPerformancePanel(),
      renderScheduleProgress(),
      annotateStudy(),
      annotateSubjects()
    ]);
  } catch (error) {
    console.warn('Competition progress: enhancement indisponível.', error);
  }
}

function queueRefresh() {
  if (state.queued) return;
  state.queued = true;
  queueMicrotask(refresh);
}

function start() {
  injectStyles();
  const app = document.querySelector('#app');
  state.observer = new MutationObserver(queueRefresh);
  if (app) state.observer.observe(app, { childList: true, subtree: true });
  queueRefresh();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
