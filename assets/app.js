import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supabaseConfig } from './supabase-config.js';
const catalogUrl = './content/catalog.json';
const menuButton = document.querySelector('#menuButton');
const nav = document.querySelector('#nav');
const refreshButton = document.querySelector('#refreshButton');
const status = document.querySelector('#catalogStatus');
const loginForm = document.querySelector('#loginForm');
const loginButton = document.querySelector('#loginButton');
const logoutButton = document.querySelector('#logoutButton');
const sessionPanel = document.querySelector('#sessionPanel');
const sessionEmail = document.querySelector('#sessionEmail');
const profileStatus = document.querySelector('#profileStatus');
const authStatus = document.querySelector('#authStatus');
const publicationBadge = document.querySelector('#publicationBadge');
const heroDescription = document.querySelector('#heroDescription');
const todayStudy = document.querySelector('#todayStudy');
const unitWorkspace = document.querySelector('#unitWorkspace');
const questionWorkspace = document.querySelector('#questionWorkspace');
const studyProgress = document.querySelector('#studyProgress');
let currentCatalog = null;
let currentSession = null;
let profileActive = false;
const latestAttempts = new Map();
const questionStartedAt = new Map();
const supabase = createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
auth: {
persistSession: true,
autoRefreshToken: true,
detectSessionInUrl: false
}
});
menuButton.addEventListener('click', () => {
const isOpen = nav.classList.toggle('open');
menuButton.setAttribute('aria-expanded', String(isOpen));
});
nav.addEventListener('click', (event) => {
if (event.target.matches('a')) {
nav.classList.remove('open');
menuButton.setAttribute('aria-expanded', 'false');
}
});
function element(tag, options = {}) {
const node = document.createElement(tag);
if (options.className) node.className = options.className;
if (options.text != null) node.textContent = options.text;
if (options.id) node.id = options.id;
return node;
}
function findById(collection, id) {
return collection.find((item) => item.id === id);
}
function firstPublishedUnit(catalog) {
return [...catalog.units].sort((a, b) => a.order - b.order)[0] ?? null;
}
function renderCatalog(catalog) {
currentCatalog = catalog;
document.querySelector('#unitCount').textContent = catalog.units.length;
document.querySelector('#questionCount').textContent = catalog.questions.length;
document.querySelector('#tafCount').textContent = catalog.tafRecords.length;
const subjectList = document.querySelector('#subjectList');
if (catalog.subjects.length === 0) {
subjectList.textContent = 'Nenhuma matéria publicada.';
} else {
const list = element('ul', { className: 'plain-list' });
for (const subject of [...catalog.subjects].sort((a, b) => a.order - b.order)) {
const item = element('li');
item.append(element('strong', { text: subject.name }));
const coverage = subject.coverage?.length ? ` — ${subject.coverage.join(' e ')}` : '';
item.append(document.createTextNode(coverage));
list.append(item);
}
subjectList.replaceChildren(list);
}
const unit = firstPublishedUnit(catalog);
if (!unit) {
publicationBadge.textContent = 'Estrutura inicial';
heroDescription.textContent = 'A plataforma está pronta para receber apenas conteúdos liberados e validados. Nenhuma unidade foi publicada ainda.';
todayStudy.textContent = 'Nenhuma unidade disponível para estudo.';
unitWorkspace.hidden = true;
questionWorkspace.textContent = 'Nenhuma questão disponível.';
studyProgress.textContent = '';
return;
}
publicationBadge.textContent = 'Primeira unidade disponível';
heroDescription.textContent = 'O primeiro estudo guiado já está disponível. Entre na plataforma para responder às questões e salvar seu progresso.';
renderTodayStudy(unit, catalog);
renderUnitWorkspace(unit, catalog);
renderQuestions(unit, catalog);
renderProgress(unit);
}
function renderTodayStudy(unit, catalog) {
const subject = findById(catalog.subjects, unit.subjectId);
const wrapper = element('div', { className: 'unit-summary' });
const label = element('p', { className: 'eyebrow dark', text: subject?.name ?? 'Unidade de estudo' });
const title = element('h3', { text: unit.title });
const objective = element('p', { text: unit.objective });
const meta = element('div', { className: 'unit-meta' });
for (const value of [unit.stage, unit.level, `${unit.estimatedMinutes} min`]) {
meta.append(element('span', { text: value }));
}
const button = element('button', { text: 'Abrir unidade' });
button.type = 'button';
button.addEventListener('click', async () => {
unitWorkspace.hidden = false;
unitWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
if (currentSession?.user && profileActive) {
await ensureUnitStarted(unit.id);
renderProgress(unit);
}
});
wrapper.append(label, title, objective, meta, button);
todayStudy.replaceChildren(wrapper);
}
function renderUnitWorkspace(unit, catalog) {
const material = findById(catalog.materials, unit.materialIds?.[0]);
if (!material) {
unitWorkspace.replaceChildren(element('p', { text: 'Material da unidade não localizado.' }));
unitWorkspace.hidden = false;
return;
}
const header = element('div', { className: 'lesson-header' });
header.append(
element('p', { className: 'eyebrow dark', text: `${unit.stage} · ${unit.level}` }),
element('h2', { text: material.title }),
element('p', { text: material.objective })
);
const blocks = element('div', { className: 'lesson-blocks' });
for (const block of material.blocks ?? []) {
blocks.append(renderMaterialBlock(block, catalog));
}
unitWorkspace.replaceChildren(header, blocks);
unitWorkspace.hidden = true;
}
function renderMaterialBlock(block, catalog) {
if (block.type === 'heading') return element('h3', { text: block.text });
if (block.type === 'subheading') return element('h4', { text: block.text });
if (block.type === 'paragraph') return element('p', { text: block.text });
if (block.type === 'quote') return element('blockquote', { text: block.text });
if (block.type === 'bullets' || block.type === 'numbered') {
const list = element(block.type === 'numbered' ? 'ol' : 'ul');
for (const itemText of block.items ?? []) list.append(element('li', { text: itemText }));
return list;
}
if (block.type === 'callout') {
const callout = element('aside', { className: `lesson-callout ${block.tone ?? 'tip'}` });
if (block.text) callout.append(element('p', { text: block.text }));
if (block.items?.length) {
const list = element('ul');
for (const itemText of block.items) list.append(element('li', { text: itemText }));
callout.append(list);
}
return callout;
}
if (block.type === 'table') {
const wrapper = element('div', { className: 'table-scroll' });
const table = element('table', { className: 'lesson-table' });
const thead = element('thead');
const headerRow = element('tr');
for (const header of block.headers ?? []) headerRow.append(element('th', { text: header }));
thead.append(headerRow);
const tbody = element('tbody');
for (const row of block.rows ?? []) {
const tr = element('tr');
for (const cell of row) tr.append(element('td', { text: cell }));
tbody.append(tr);
}
table.append(thead, tbody);
wrapper.append(table);
return wrapper;
}
if (block.type === 'sources') {
const list = element('ul');
for (const sourceId of block.sourceIds ?? []) {
const source = findById(catalog.sources, sourceId);
if (!source) continue;
const item = element('li');
const link = element('a', { text: source.title });
link.href = source.url;
link.target = '_blank';
link.rel = 'noopener noreferrer';
item.append(link);
list.append(item);
}
return list;
}
return element('p', { text: '' });
}
function renderQuestions(unit, catalog) {
questionWorkspace.replaceChildren();
const questionSet = findById(catalog.questionSets, unit.questionSetIds?.[0]);
const intro = element('div', { className: 'question-set-header' });
intro.append(
element('p', { className: 'eyebrow dark', text: questionSet?.type ?? 'Questões' }),
element('h3', { text: questionSet?.title ?? 'Questões da unidade' }),
element('p', { text: questionSet?.objective ?? 'Responda às questões da unidade.' })
);
if (!currentSession?.user || !profileActive) {
intro.append(element('p', {
className: 'login-required',
text: 'Entre na plataforma para responder e salvar as tentativas. A aula pode ser lida sem login.'
}));
}
questionWorkspace.append(intro);
const questions = unit.questionIds
.map((id) => findById(catalog.questions, id))
.filter(Boolean);
questions.forEach((question, index) => {
questionWorkspace.append(renderQuestionCard(question, unit, index, questions.length));
});
}
function renderQuestionCard(question, unit, index, total) {
if (!questionStartedAt.has(question.id)) questionStartedAt.set(question.id, Date.now());
const card = element('article', { className: 'question-card' });
card.dataset.questionId = question.id;
card.append(
element('p', { className: 'question-number', text: `Questão ${index + 1} de ${total} · ${question.difficulty}` }),
element('h4', { text: question.statement })
);
const form = element('form', { className: 'question-form' });
const fieldset = element('fieldset');
const legend = element('legend', { text: 'Escolha uma alternativa' });
fieldset.append(legend);
const latest = latestAttempts.get(question.id);
for (const option of question.options ?? []) {
const label = element('label', { className: 'option-row' });
const input = document.createElement('input');
input.type = 'radio';
input.name = `answer-${question.id}`;
input.value = option.id;
input.required = true;
input.disabled = !currentSession?.user || !profileActive;
if (latest?.answer === option.id) input.checked = true;
const marker = element('span', { className: 'option-marker', text: option.id });
const text = element('span', { text: option.text });
label.append(input, marker, text);
fieldset.append(label);
}
const submit = element('button', { text: latest ? 'Responder novamente' : 'Responder' });
submit.type = 'submit';
submit.disabled = !currentSession?.user || !profileActive;
const saveStatus = element('span', { className: 'question-save-status' });
const actions = element('div', { className: 'question-actions' });
actions.append(submit, saveStatus);
form.append(fieldset, actions);
form.addEventListener('submit', async (event) => {
event.preventDefault();
const selected = new FormData(form).get(`answer-${question.id}`);
if (!selected) {
saveStatus.textContent = 'Selecione uma alternativa.';
return;
}
submit.disabled = true;
submit.textContent = 'Salvando…';
saveStatus.textContent = '';
try {
await saveQuestionAttempt(question, unit, String(selected));
saveStatus.textContent = 'Tentativa salva.';
renderQuestions(unit, currentCatalog);
renderProgress(unit);
} catch (error) {
console.error(error);
saveStatus.textContent = 'Não foi possível salvar. Tente novamente.';
submit.disabled = false;
submit.textContent = latest ? 'Responder novamente' : 'Responder';
}
});
card.append(form);
if (latest) card.append(renderFeedback(question, latest));
return card;
}
function renderFeedback(question, attempt) {
const feedback = element('div', { className: `feedback ${attempt.is_correct ? 'correct' : 'incorrect'}` });
feedback.append(element('strong', {
text: attempt.is_correct ? 'Resposta correta.' : `Resposta incorreta. Gabarito: ${question.answer}.`
}));
feedback.append(element('p', { text: question.commentary }));
const foundation = element('p');
foundation.append(element('strong', { text: 'Fundamento: ' }), document.createTextNode(question.foundation));
feedback.append(foundation);
return feedback;
}
function renderProgress(unit) {
const total = unit.questionIds.length;
const answered = unit.questionIds.filter((id) => latestAttempts.has(id)).length;
const correct = unit.questionIds.filter((id) => latestAttempts.get(id)?.is_correct === true).length;
const percent = total ? Math.round((answered / total) * 100) : 0;
const mastery = total ? Math.round((correct / total) * 100) : 0;
const wrapper = element('div', { className: 'progress-panel' });
wrapper.append(
element('strong', { text: answered === total ? 'Unidade concluída' : `Progresso: ${answered} de ${total} questões` }),
element('p', { text: answered ? `Acertos atuais: ${correct} de ${answered}. Aproveitamento da unidade: ${mastery}%.` : 'Responda às questões para iniciar o progresso.' })
);
const track = element('div', { className: 'progress-track' });
const fill = element('span', { className: 'progress-fill' });
fill.style.width = `${percent}%`;
track.append(fill);
wrapper.append(track);
studyProgress.replaceChildren(wrapper);
}
async function ensureUnitStarted(unitId) {
if (!currentSession?.user || !profileActive) return;
const now = new Date().toISOString();
const { data, error } = await supabase
.from('study_units')
.select('id, status, started_at')
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
const { error: updateError } = await supabase
.from('study_units')
.update({ status: 'in_progress', last_activity_at: now })
.eq('id', data.id);
if (updateError) throw updateError;
}
}
async function saveQuestionAttempt(question, unit, answer) {
if (!currentSession?.user || !profileActive) throw new Error('Sessão autenticada obrigatória.');
await ensureUnitStarted(unit.id);
const { count, error: countError } = await supabase
.from('question_attempts')
.select('id', { count: 'exact', head: true })
.eq('profile_id', supabaseConfig.profileId)
.eq('question_id', question.id);
if (countError) throw countError;
const isCorrect = answer === question.answer;
const durationMs = Math.max(0, Date.now() - (questionStartedAt.get(question.id) ?? Date.now()));
const { data: attempt, error } = await supabase
.from('question_attempts')
.insert({
profile_id: supabaseConfig.profileId,
question_id: question.id,
unit_id: unit.id,
question_set_id: unit.questionSetIds?.[0] ?? null,
answer,
is_correct: isCorrect,
duration_ms: durationMs,
attempt_number: (count ?? 0) + 1,
client_event_id: crypto.randomUUID()
})
.select('id, question_id, answer, is_correct, attempt_number, answered_at')
.single();
if (error) throw error;
latestAttempts.set(question.id, attempt);
questionStartedAt.set(question.id, Date.now());
if (!isCorrect) {
const { error: errorItemError } = await supabase.from('error_items').insert({
profile_id: supabaseConfig.profileId,
question_id: question.id,
attempt_id: attempt.id,
error_type: 'interpretation',
status: 'open'
});
if (errorItemError) console.error('Falha ao registrar caderno de erros:', errorItemError);
}
await updateUnitProgress(unit);
}
async function updateUnitProgress(unit) {
const total = unit.questionIds.length;
const answered = unit.questionIds.filter((id) => latestAttempts.has(id)).length;
const correct = unit.questionIds.filter((id) => latestAttempts.get(id)?.is_correct === true).length;
const completed = total > 0 && answered === total;
const now = new Date().toISOString();
const mastery = total ? Math.round((correct / total) * 100) : 0;
const { error } = await supabase
.from('study_units')
.update({
status: completed ? 'completed' : 'in_progress',
mastery_percent: mastery,
last_activity_at: now,
completed_at: completed ? now : null
})
.eq('profile_id', supabaseConfig.profileId)
.eq('unit_id', unit.id);
if (error) throw error;
}
async function loadStudentProgress() {
latestAttempts.clear();
if (!currentSession?.user || !profileActive || !currentCatalog) {
if (currentCatalog) renderCatalog(currentCatalog);
return;
}
const unit = firstPublishedUnit(currentCatalog);
if (!unit) return;
const { data, error } = await supabase
.from('question_attempts')
.select('question_id, answer, is_correct, attempt_number, answered_at')
.eq('profile_id', supabaseConfig.profileId)
.in('question_id', unit.questionIds)
.order('answered_at', { ascending: false });
if (error) {
console.error(error);
authStatus.textContent = 'Login confirmado, mas o progresso não pôde ser carregado.';
return;
}
for (const attempt of data ?? []) {
if (!latestAttempts.has(attempt.question_id)) latestAttempts.set(attempt.question_id, attempt);
}
renderCatalog(currentCatalog);
}
async function loadCatalog() {
status.textContent = 'Carregando…';
try {
const response = await fetch(`${catalogUrl}?v=${Date.now()}`, { cache: 'no-store' });
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const catalog = await response.json();
renderCatalog(catalog);
status.textContent = `Catálogo v${catalog.contentVersion} validado.`;
if (currentSession?.user && profileActive) await loadStudentProgress();
} catch (error) {
console.error(error);
status.textContent = 'Não foi possível carregar o catálogo.';
}
}
function setAuthBusy(isBusy) {
loginButton.disabled = isBusy;
loginButton.textContent = isBusy ? 'Entrando…' : 'Entrar';
}
async function loadStudentProfile() {
profileStatus.textContent = 'Verificando…';
const { data, error } = await supabase
.from('student_profiles')
.select('id, is_active')
.eq('id', supabaseConfig.profileId)
.maybeSingle();
if (error) {
console.error(error);
profileActive = false;
profileStatus.textContent = 'Não foi possível validar o perfil.';
return;
}
profileActive = data?.is_active === true;
profileStatus.textContent = profileActive
? `${data.id} — ativo`
: 'Acesso autenticado, perfil ainda não provisionado.';
}
async function renderSession(session) {
currentSession = session;
const signedIn = Boolean(session?.user);
loginForm.hidden = signedIn;
sessionPanel.hidden = !signedIn;
authStatus.textContent = '';
if (!signedIn) {
profileActive = false;
latestAttempts.clear();
sessionEmail.textContent = '';
profileStatus.textContent = 'Não autenticado';
if (currentCatalog) renderCatalog(currentCatalog);
return;
}
sessionEmail.textContent = session.user.email ?? 'usuário autenticado';
await loadStudentProfile();
await loadStudentProgress();
}
loginForm.addEventListener('submit', async (event) => {
event.preventDefault();
setAuthBusy(true);
authStatus.textContent = '';
const formData = new FormData(loginForm);
const email = String(formData.get('email') ?? '').trim();
const password = String(formData.get('password') ?? '');
try {
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
loginForm.reset();
authStatus.textContent = 'Acesso confirmado.';
} catch (error) {
console.error(error);
authStatus.textContent = 'Não foi possível entrar. Verifique o e-mail e a senha.';
} finally {
setAuthBusy(false);
}
});
logoutButton.addEventListener('click', async () => {
authStatus.textContent = 'Encerrando sessão…';
const { error } = await supabase.auth.signOut();
authStatus.textContent = error ? 'Não foi possível encerrar a sessão.' : 'Sessão encerrada.';
});
supabase.auth.onAuthStateChange((_event, session) => {
void renderSession(session);
});
refreshButton.addEventListener('click', loadCatalog);
const [{ data: sessionData }] = await Promise.all([
supabase.auth.getSession(),
loadCatalog()
]);
await renderSession(sessionData.session);
