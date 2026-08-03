const catalogUrl = './content/catalog.json';
const menuButton = document.querySelector('#menuButton');
const nav = document.querySelector('#nav');
const refreshButton = document.querySelector('#refreshButton');
const status = document.querySelector('#catalogStatus');

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

refreshButton.addEventListener('click', loadCatalog);
loadCatalog();
