import { createClient } from './supabase-client.js';
import { supabaseConfig } from './supabase-config.js';

const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
});

const TEST_OPTIONS = [
  { id: 'barra_dinamica', label: 'Barra dinâmica', units: ['repetições'] },
  { id: 'barra_isometrica', label: 'Barra isométrica', units: ['segundos'] },
  { id: 'flexao_bracos', label: 'Flexão de braços', units: ['repetições'] },
  { id: 'abdominal', label: 'Abdominal', units: ['repetições'] },
  { id: 'corrida_12_minutos', label: 'Corrida de 12 minutos', units: ['metros'] },
  { id: 'natacao', label: 'Natação', units: ['segundos', 'metros'] },
  { id: 'outro', label: 'Outro treino físico', units: ['repetições', 'segundos', 'metros', 'minutos'] }
];

const UNIT_LABELS = {
  repetições: 'repetições',
  segundos: 'segundos',
  metros: 'metros',
  minutos: 'minutos'
};

let rendering = false;
let renderQueued = false;

function el(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text != null) node.textContent = options.text;
  if (options.id) node.id = options.id;
  if (options.href) node.href = options.href;
  return node;
}

function testLabel(testId) {
  return TEST_OPTIONS.find(({ id }) => id === testId)?.label ?? testId;
}

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatMeasurement(value, unit) {
  if (value == null || value === '') return 'Resultado não informado';
  const numeric = Number(value);
  const formatted = Number.isFinite(numeric)
    ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(numeric)
    : String(value);
  return `${formatted} ${UNIT_LABELS[unit] ?? unit ?? ''}`.trim();
}

function publicIntro() {
  const fragment = document.createDocumentFragment();
  const intro = el('section', { className: 'card taf-intro' });
  intro.append(
    el('p', { className: 'status-pill', text: 'Módulo funcional de acompanhamento' }),
    el('h2', { text: 'Acompanhamento de treino' }),
    el('p', {
      text: 'Registre sessões físicas e acompanhe a evolução sem confundir treino pessoal com teste oficial.'
    })
  );

  const truth = el('section', { className: 'card warning-card taf-truth' });
  truth.append(
    el('h2', { text: 'Regra de segurança e validade' }),
    el('p', {
      text: 'A plataforma não publica índice oficial vigente nesta etapa. Índice histórico não é índice vigente, e treino não comprova aptidão em concurso.'
    }),
    el('p', {
      text: 'A orientação aqui é geral e não substitui avaliação médica, orientação profissional ou o teste oficial previsto em edital.'
    })
  );

  const privacy = el('section', { className: 'card taf-privacy' });
  privacy.append(
    el('h2', { text: 'Privacidade do progresso' }),
    el('p', {
      text: 'Resultados pessoais ficam exclusivamente no Supabase vinculado ao perfil STU-MYCHAEL. Eles não são enviados ao GitHub nem ao Notion editorial.'
    })
  );

  fragment.append(intro, truth, privacy);
  return fragment;
}

function loginCard() {
  const card = el('section', { className: 'card empty-card' });
  card.append(
    el('h2', { text: 'Acesso individual necessário' }),
    el('p', { text: 'Entre na plataforma para registrar e consultar treinos pessoais.' }),
    el('a', { className: 'primary-link', text: 'Ir para o acesso', href: 'index.html#acesso' })
  );
  return card;
}

async function readAccess() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session?.user) return { session: null, profileActive: false };

  const { data: profile, error: profileError } = await supabase
    .from('student_profiles')
    .select('id, status')
    .eq('id', supabaseConfig.profileId)
    .maybeSingle();
  if (profileError) throw profileError;

  return {
    session,
    profileActive: profile?.status === 'active'
  };
}

async function loadAttempts() {
  const { data, error } = await supabase
    .from('taf_attempts')
    .select('id, test_id, reference_id, performed_at, measured_value, measured_unit, medical_clearance, professional_supervision, notes, created_at')
    .eq('profile_id', supabaseConfig.profileId)
    .order('performed_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

function historySection(attempts) {
  const section = el('section', { className: 'card taf-history' });
  section.dataset.tafHistory = 'true';
  section.append(
    el('p', { className: 'eyebrow', text: 'Histórico privado' }),
    el('h2', { text: 'Treinos mais recentes' })
  );

  if (!attempts.length) {
    section.append(el('p', {
      className: 'taf-empty',
      text: 'Nenhum treino registrado. O primeiro registro aparecerá aqui.'
    }));
    return section;
  }

  const list = el('div', { className: 'taf-history-list' });
  for (const attempt of attempts) {
    const row = el('article', { className: 'taf-history-item' });
    const copy = el('div');
    copy.append(
      el('p', { className: 'eyebrow', text: formatDate(attempt.performed_at) }),
      el('h3', { text: testLabel(attempt.test_id) }),
      el('p', { className: 'taf-result', text: formatMeasurement(attempt.measured_value, attempt.measured_unit) })
    );

    const tags = el('div', { className: 'tag-row' });
    tags.append(
      el('span', { text: attempt.medical_clearance ? 'Avaliação médica informada' : 'Sem avaliação médica informada' }),
      el('span', { text: attempt.professional_supervision ? 'Com supervisão profissional' : 'Sem supervisão profissional informada' })
    );
    copy.append(tags);
    if (attempt.notes) copy.append(el('p', { className: 'taf-notes', text: attempt.notes }));
    row.append(copy);
    list.append(row);
  }
  section.append(list);
  return section;
}

function trainingForm(onSaved) {
  const card = el('section', { className: 'card taf-form-card' });
  card.append(
    el('p', { className: 'eyebrow', text: 'Registro pessoal' }),
    el('h2', { text: 'Registrar treino' }),
    el('p', { text: 'Informe somente o que foi realmente executado. Este registro não é resultado de teste oficial.' })
  );

  const form = el('form', { className: 'taf-form' });

  const dateLabel = el('label', { text: 'Data e horário do treino' });
  dateLabel.htmlFor = 'tafPerformedAt';
  const performedAt = el('input', { id: 'tafPerformedAt' });
  performedAt.name = 'performed_at';
  performedAt.type = 'datetime-local';
  performedAt.value = localDateTimeValue();
  performedAt.required = true;

  const testLabelNode = el('label', { text: 'Tipo de teste ou exercício' });
  testLabelNode.htmlFor = 'tafTest';
  const test = el('select', { id: 'tafTest' });
  test.name = 'test_id';
  test.required = true;
  for (const option of TEST_OPTIONS) {
    const item = el('option', { text: option.label });
    item.value = option.id;
    test.append(item);
  }

  const valueLabel = el('label', { text: 'Resultado medido' });
  valueLabel.htmlFor = 'tafMeasuredValue';
  const value = el('input', { id: 'tafMeasuredValue' });
  value.name = 'measured_value';
  value.type = 'number';
  value.min = '0';
  value.step = '0.01';
  value.inputMode = 'decimal';
  value.required = true;

  const unitLabel = el('label', { text: 'Unidade de medida' });
  unitLabel.htmlFor = 'tafMeasuredUnit';
  const unit = el('select', { id: 'tafMeasuredUnit' });
  unit.name = 'measured_unit';
  unit.required = true;

  const refreshUnits = () => {
    const option = TEST_OPTIONS.find(({ id }) => id === test.value) ?? TEST_OPTIONS[0];
    const previous = unit.value;
    unit.replaceChildren();
    for (const allowed of option.units) {
      const item = el('option', { text: UNIT_LABELS[allowed] ?? allowed });
      item.value = allowed;
      unit.append(item);
    }
    if (option.units.includes(previous)) unit.value = previous;
  };
  test.addEventListener('change', refreshUnits);
  refreshUnits();

  const clearanceLabel = el('label', { className: 'taf-check' });
  const clearance = el('input');
  clearance.name = 'medical_clearance';
  clearance.type = 'checkbox';
  clearanceLabel.append(clearance, el('span', { text: 'Possuo avaliação médica para atividade física' }));

  const supervisionLabel = el('label', { className: 'taf-check' });
  const supervision = el('input');
  supervision.name = 'professional_supervision';
  supervision.type = 'checkbox';
  supervisionLabel.append(supervision, el('span', { text: 'O treino teve supervisão profissional' }));

  const notesLabel = el('label', { text: 'Observações opcionais' });
  notesLabel.htmlFor = 'tafNotes';
  const notes = el('textarea', { id: 'tafNotes' });
  notes.name = 'notes';
  notes.rows = 4;
  notes.maxLength = 500;
  notes.placeholder = 'Ex.: ritmo confortável, execução interrompida, condição do local.';

  const submit = el('button', { text: 'Salvar treino' });
  submit.type = 'submit';
  const status = el('p', { className: 'inline-status taf-save-status' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  form.append(
    dateLabel,
    performedAt,
    testLabelNode,
    test,
    valueLabel,
    value,
    unitLabel,
    unit,
    clearanceLabel,
    supervisionLabel,
    notesLabel,
    notes,
    submit,
    status
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Salvando…';
    status.textContent = '';
    status.dataset.tone = '';

    try {
      const formData = new FormData(form);
      const measuredValue = Number(formData.get('measured_value'));
      const performedValue = String(formData.get('performed_at') ?? '');
      if (!Number.isFinite(measuredValue) || measuredValue < 0 || !performedValue) {
        throw new Error('Dados do treino inválidos.');
      }

      const { error } = await supabase.from('taf_attempts').insert({
        profile_id: supabaseConfig.profileId,
        test_id: String(formData.get('test_id') ?? ''),
        reference_id: null,
        performed_at: new Date(performedValue).toISOString(),
        measured_value: measuredValue,
        measured_unit: String(formData.get('measured_unit') ?? ''),
        medical_clearance: formData.get('medical_clearance') === 'on',
        professional_supervision: formData.get('professional_supervision') === 'on',
        notes: String(formData.get('notes') ?? '').trim() || null,
        client_event_id: crypto.randomUUID()
      });
      if (error) throw error;

      status.textContent = 'Treino registrado no Supabase privado.';
      status.dataset.tone = 'success';
      value.value = '';
      notes.value = '';
      performedAt.value = localDateTimeValue();
      await onSaved();
    } catch (error) {
      console.error(error);
      status.textContent = 'Não foi possível salvar o treino. Confira os dados e tente novamente.';
      status.dataset.tone = 'error';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Salvar treino';
    }
  });

  card.append(form);
  return card;
}

async function renderTafModule() {
  if (rendering || document.body.dataset.page !== 'taf') return;
  const target = document.querySelector('#pageContent');
  if (!target) return;
  rendering = true;

  try {
    const { session, profileActive } = await readAccess();
    const root = el('div', { className: 'taf-module-root' });
    root.dataset.tafModule = 'true';
    root.append(publicIntro());

    if (!session?.user || !profileActive) {
      root.append(loginCard());
      target.replaceChildren(root);
      return;
    }

    const attempts = await loadAttempts();
    let history = historySection(attempts);
    const form = trainingForm(async () => {
      const updated = historySection(await loadAttempts());
      history.replaceWith(updated);
      history = updated;
    });
    root.append(form, history);
    target.replaceChildren(root);

    const status = document.querySelector('#pageStatus');
    if (status) status.textContent = '';
  } catch (error) {
    console.error(error);
    const root = el('div', { className: 'taf-module-root' });
    root.dataset.tafModule = 'true';
    root.append(publicIntro());
    const card = el('section', { className: 'card empty-card' });
    card.append(
      el('h2', { text: 'Não foi possível carregar os registros' }),
      el('p', { text: 'Atualize a página e tente novamente. Nenhum dado foi alterado.' })
    );
    root.append(card);
    target.replaceChildren(root);
  } finally {
    rendering = false;
  }
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(async () => {
    renderQueued = false;
    await renderTafModule();
  });
}

function waitForTarget() {
  const existing = document.querySelector('#pageContent');
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const target = document.querySelector('#pageContent');
      if (!target) return;
      observer.disconnect();
      resolve(target);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

async function bootTaf() {
  if (document.body.dataset.page !== 'taf') return;
  const target = await waitForTarget();
  const observer = new MutationObserver(() => {
    if (!rendering && !target.querySelector('[data-taf-module="true"]')) queueRender();
  });
  observer.observe(target, { childList: true });

  await renderTafModule();
  supabase.auth.onAuthStateChange(() => queueRender());
}

bootTaf();
