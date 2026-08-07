import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';
import { nextGuidedStep } from './applicability-core.js';

const pageId = document.body.dataset.page || 'home';
const CATALOG_URL = './content/catalog.json';
const APPLICABILITY_URL = './content/content-applicability.json';

const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

const state = {
  publicPromise: null,
  queued: false,
  busy: false
};

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

async function privateSnapshot({ attempts = false } = {}) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) {
    return { authenticated: false, studyUnits: [], attempts: [] };
  }

  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .select('id, status')
    .eq('id', supabaseConfig.profileId)
    .maybeSingle();
  if (profileError || profile?.status !== 'active') {
    return { authenticated: false, studyUnits: [], attempts: [] };
  }

  const studyRequest = supabase
    .from('study_units')
    .select('unit_id, status, mastery_percent, last_activity_at')
    .eq('profile_id', supabaseConfig.profileId);

  if (!attempts) {
    const studyResult = await studyRequest;
    if (studyResult.error) throw studyResult.error;
    return { authenticated: true, studyUnits: studyResult.data ?? [], attempts: [] };
  }

  const [studyResult, attemptsResult] = await Promise.all([
    studyRequest,
    supabase
      .from('question_attempts')
      .select('question_id, is_correct, answered_at')
      .eq('profile_id', supabaseConfig.profileId)
  ]);
  if (studyResult.error || attemptsResult.error) throw studyResult.error || attemptsResult.error;
  return {
    authenticated: true,
    studyUnits: studyResult.data ?? [],
    attempts: attemptsResult.data ?? []
  };
}

function latestAttemptsByQuestion(attempts) {
  const latest = new Map();
  for (const attempt of attempts ?? []) {
    if (!attempt?.question_id) continue;
    const previous = latest.get(attempt.question_id);
    const previousAt = new Date(previous?.answered_at ?? 0).getTime();
    const currentAt = new Date(attempt.answered_at ?? 0).getTime();
    if (!previous || currentAt >= previousAt) latest.set(attempt.question_id, attempt);
  }
  return latest;
}

function percent(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

async function alignHomeWithCycle() {
  if (pageId !== 'home') return;
  const hero = document.querySelector('.hero-card');
  const nextCopy = hero?.querySelector('.home-next-step');
  if (!hero || !nextCopy) return;

  const privateProgress = await privateSnapshot();
  if (!privateProgress.authenticated) return;
  const { catalog, applicability } = await publicData();
  const step = nextGuidedStep({
    catalog,
    applicability,
    studyUnits: privateProgress.studyUnits
  });
  const signature = `${step.phase}:${step.unit?.id ?? 'none'}`;
  if (hero.dataset.guidedCycle === signature) return;
  hero.dataset.guidedCycle = signature;

  const actions = hero.querySelector('.button-row');
  const primary = actions?.querySelector('a.primary-link');
  const questionLink = [...(actions?.querySelectorAll('a') ?? [])]
    .find((link) => link.getAttribute('href')?.includes('questoes.html'));

  if (step.unit) {
    nextCopy.textContent = `Próximo passo do seu ciclo: ${step.unit.title}. ${step.message}`;
    if (primary) {
      primary.href = `estudar.html?unit=${encodeURIComponent(step.unit.id)}`;
      primary.textContent = 'Continuar próximo passo';
    }
    if (questionLink) {
      questionLink.href = `questoes.html?unit=${encodeURIComponent(step.unit.id)}`;
      questionLink.textContent = 'Questões desta unidade';
      questionLink.hidden = false;
    }
    return;
  }

  nextCopy.textContent = step.message;
  if (primary) {
    primary.href = 'cronograma.html';
    primary.textContent = 'Ver próximo passo do ciclo';
  }
  if (questionLink) questionLink.hidden = true;
}

async function alignPerformanceWithLatestAttempts() {
  if (pageId !== 'performance') return;
  const grid = document.querySelector('.performance-grid');
  if (!grid || grid.dataset.latestAttemptMetrics === 'true') return;

  const privateProgress = await privateSnapshot({ attempts: true });
  if (!privateProgress.authenticated) return;
  const latest = latestAttemptsByQuestion(privateProgress.attempts);
  const answered = [...latest.values()];
  const correct = answered.filter((attempt) => attempt.is_correct === true).length;
  const accuracy = percent(correct, answered.length);
  const cards = [...grid.querySelectorAll('.metric-card')];
  if (cards.length < 2) return;

  const firstValue = cards[0].querySelector('strong');
  const firstLabel = cards[0].querySelector('span');
  const secondValue = cards[1].querySelector('strong');
  const secondLabel = cards[1].querySelector('span');
  if (firstValue) firstValue.textContent = String(answered.length);
  if (firstLabel) firstLabel.textContent = 'questões respondidas';
  if (secondValue) secondValue.textContent = `${accuracy}%`;
  if (secondLabel) secondLabel.textContent = 'acerto atual · última tentativa';
  grid.dataset.latestAttemptMetrics = 'true';
}

function alignScheduleCopy() {
  if (pageId !== 'schedule') return;
  const page = document.querySelector('.cycle-page');
  if (!page || page.dataset.matrixCopyCurrent === 'true') return;

  const heroCopy = page.querySelector('.cycle-hero > p:last-child');
  if (heroCopy) {
    heroCopy.textContent = 'A matriz curricular PMDF × PMGO × PMMG já está estruturada. O cronograma definitivo depende agora de cobertura editorial representativa para calibrar pesos sem adivinhação; a estrutura atual já orienta o iniciante desde o primeiro conteúdo.';
  }

  const publishedCopy = page.querySelector('.published-cycle-content > p:last-of-type');
  if (publishedCopy) {
    publishedCopy.textContent = 'A matriz curricular dos três concursos já está validada como camada de planejamento. Esta lista mostra apenas o acervo que já foi publicado; pesos finais e rotação específica continuam dependentes de cobertura editorial representativa.';
  }

  const decision = page.querySelector('.schedule-decision');
  const decisionTitle = decision?.querySelector('h2');
  const decisionCopy = decision?.querySelector('p:last-child');
  if (decisionTitle) decisionTitle.textContent = 'Depois de cobertura editorial representativa — não depois da última questão existir';
  if (decisionCopy) {
    decisionCopy.textContent = 'A matriz curricular já está pronta. O próximo requisito é ter teoria e questões suficientes nos três concursos para estimar volume e dificuldade com segurança. Esperar 100% do banco atrasaria o uso; fixar pesos agora criaria precisão falsa. A regra permanece: estrutura agora, calibração progressiva e pesos definitivos quando o acervo representar adequadamente PMDF, PMGO e PMMG.';
  }
  page.dataset.matrixCopyCurrent = 'true';
}

async function refresh() {
  state.queued = false;
  if (state.busy) return;
  state.busy = true;
  try {
    alignScheduleCopy();
    await alignHomeWithCycle();
    await alignPerformanceWithLatestAttempts();
  } catch (error) {
    console.warn('Guided UX: melhoria progressiva indisponível.', error);
  } finally {
    state.busy = false;
  }
}

function queueRefresh() {
  if (state.queued) return;
  state.queued = true;
  queueMicrotask(refresh);
}

function start() {
  const content = document.querySelector('#pageContent');
  if (content) new MutationObserver(queueRefresh).observe(content, { childList: true, subtree: true });
  queueRefresh();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
