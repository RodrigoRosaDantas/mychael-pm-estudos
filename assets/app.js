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

function renderCatalog(catalog) {
  document.querySelector('#unitCount').textContent = catalog.units.length;
  document.querySelector('#questionCount').textContent = catalog.questions.length;
  document.querySelector('#tafCount').textContent = catalog.tafRecords.length;

  const subjectList = document.querySelector('#subjectList');
  if (catalog.subjects.length === 0) {
    subjectList.textContent = 'Nenhuma matéria publicada.';
  } else {
    const list = document.createElement('ul');
    for (const subject of catalog.subjects) {
      const item = document.createElement('li');
      item.textContent = subject.name;
      list.append(item);
    }
    subjectList.replaceChildren(list);
  }

  const todayStudy = document.querySelector('#todayStudy');
  const nextUnit = [...catalog.units].sort((a, b) => a.order - b.order)[0];
  todayStudy.textContent = nextUnit
    ? `${nextUnit.title} — ${nextUnit.estimatedMinutes} minutos.`
    : 'Nenhuma unidade disponível para estudo.';
}

async function loadCatalog() {
  status.textContent = 'Carregando…';
  try {
    const response = await fetch(`${catalogUrl}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    renderCatalog(catalog);
    status.textContent = 'Catálogo validado.';
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
    profileStatus.textContent = 'Não foi possível validar o perfil.';
    return;
  }

  profileStatus.textContent = data?.is_active
    ? `${data.id} — ativo`
    : 'Acesso autenticado, perfil ainda não provisionado.';
}

async function renderSession(session) {
  const signedIn = Boolean(session?.user);
  loginForm.hidden = signedIn;
  sessionPanel.hidden = !signedIn;
  authStatus.textContent = '';

  if (!signedIn) {
    sessionEmail.textContent = '';
    profileStatus.textContent = 'Não autenticado';
    return;
  }

  sessionEmail.textContent = session.user.email ?? 'usuário autenticado';
  await loadStudentProfile();
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
