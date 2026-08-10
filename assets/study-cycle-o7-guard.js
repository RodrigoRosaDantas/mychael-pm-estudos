const pageId = document.body.dataset.page || '';
const GUARD_TITLE = 'Rotação específica ainda desativada';
const GUARD_COPY = 'As unidades específicas já publicadas permanecem fora destes quatro ciclos iniciais. A rotação automática de específicas só será ativada após a calibração do O7; novas matérias e unidades entram apenas nos ciclos futuros.';

function ensureSpecificRotationGuard() {
  if (pageId !== 'schedule') return;
  const future = document.querySelector('.cycle-v1-future');
  if (!future) return;
  const heading = future.querySelector('h2');
  const copy = future.querySelector('p:last-child');
  if (heading && heading.textContent !== GUARD_TITLE) heading.textContent = GUARD_TITLE;
  if (copy && copy.textContent !== GUARD_COPY) copy.textContent = GUARD_COPY;
}

function start() {
  const app = document.querySelector('#app');
  if (app) new MutationObserver(ensureSpecificRotationGuard).observe(app, { childList: true, subtree: true, characterData: true });
  ensureSpecificRotationGuard();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
