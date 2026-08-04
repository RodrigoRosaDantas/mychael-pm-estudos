import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PAGE_PATHS = Object.freeze([
  'index.html', 'estudar.html', 'materias.html', 'questoes.html', 'revisoes.html',
  'erros.html', 'provas.html', 'simulados.html', 'taf.html', 'desempenho.html',
  'configuracoes.html'
]);
export const REQUIRED_DEPLOYMENT_PATHS = Object.freeze([
  ...PAGE_PATHS,
  'assets/site.js',
  'assets/styles.css',
  'assets/supabase-config.js',
  'content/catalog.json',
  'content/manifest.json'
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function toBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}
export function sha256(value) {
  return createHash('sha256').update(toBuffer(value)).digest('hex');
}
export function normalizeBaseUrl(input) {
  assert(input, 'Informe a URL pública do GitHub Pages.');
  const url = new URL(input);
  assert(['http:', 'https:'].includes(url.protocol), 'A URL pública deve usar HTTP ou HTTPS.');
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.toString();
}

export function validatePublicationFiles(files) {
  for (const path of REQUIRED_DEPLOYMENT_PATHS) assert(files.has(path), `Arquivo obrigatório ausente: ${path}`);
  const site = toBuffer(files.get('assets/site.js')).toString('utf8');
  const styles = toBuffer(files.get('assets/styles.css')).toString('utf8');
  for (const page of PAGE_PATHS) {
    const html = toBuffer(files.get(page)).toString('utf8');
    assert(html.includes('id="app"'), `${page}: raiz da aplicação ausente.`);
    assert(html.includes('./assets/site.js'), `${page}: módulo compartilhado ausente.`);
  }
  for (const page of ['estudar.html', 'questoes.html', 'revisoes.html', 'erros.html', 'desempenho.html']) {
    assert(site.includes(`'${page}'`), `Navegação pública sem ${page}.`);
  }
  assert(site.includes("from('error_items')"), 'O caderno de erros não consulta dados privados.');
  assert(site.includes('loadOpenErrorQuestionIds'), 'A opção de refazer erros está ausente.');
  assert(site.includes('resolveError'), 'A resolução de erros está ausente.');
  assert(!/signUp\s*\(|service_role|sb_secret_/i.test(site), 'O módulo público contém cadastro ou segredo elevado.');
  assert(styles.includes('@media(max-width:860px)'), 'O CSS não contém visualização móvel.');
  assert(styles.includes('.app-shell{min-height:100vh;display:grid'), 'O CSS não contém visualização para computador.');

  const catalogBuffer = toBuffer(files.get('content/catalog.json'));
  const manifestBuffer = toBuffer(files.get('content/manifest.json'));
  const catalog = JSON.parse(catalogBuffer.toString('utf8'));
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  const catalogEntry = manifest.files?.find(({ path }) => path === 'content/catalog.json');
  assert(catalogEntry, 'O manifesto não referencia content/catalog.json.');
  assert(manifest.contentVersion === catalog.contentVersion, 'Versões do catálogo e do manifesto divergem.');
  assert(catalogEntry.sha256 === sha256(catalogBuffer), 'O SHA-256 do catálogo não confere com o manifesto.');
  assert(catalogEntry.bytes === catalogBuffer.byteLength, 'O tamanho do catálogo não confere com o manifesto.');
  assert(Array.isArray(catalog.units), 'O catálogo não possui unidades.');
  assert(Array.isArray(catalog.questions), 'O catálogo não possui questões.');
  return {
    contentVersion: catalog.contentVersion,
    publicationStatus: catalog.publicationStatus,
    pages: PAGE_PATHS.length,
    units: catalog.units.length,
    questions: catalog.questions.length,
    catalogSha256: catalogEntry.sha256
  };
}

export function compareDeploymentFiles(expectedFiles, deployedFiles) {
  for (const path of REQUIRED_DEPLOYMENT_PATHS) {
    assert(deployedFiles.has(path), `Arquivo não encontrado no deploy: ${path}`);
    const expectedSha = sha256(expectedFiles.get(path));
    const deployedSha = sha256(deployedFiles.get(path));
    assert(expectedSha === deployedSha, `Deploy desatualizado ou divergente em ${path}: esperado ${expectedSha}, recebido ${deployedSha}.`);
  }
}
export async function loadFilesFromDisk(rootDir = process.cwd()) {
  const files = new Map();
  for (const path of REQUIRED_DEPLOYMENT_PATHS) files.set(path, await readFile(resolve(rootDir, path)));
  return files;
}
export async function fetchDeploymentFiles(baseUrl, fetchImpl = fetch) {
  const files = new Map();
  for (const path of REQUIRED_DEPLOYMENT_PATHS) {
    const url = new URL(path, baseUrl);
    const response = await fetchImpl(url, { cache: 'no-store', headers: { accept: path.endsWith('.json') ? 'application/json' : '*/*', 'cache-control': 'no-cache' } });
    assert(response.ok, `Falha HTTP ${response.status} ao consultar ${url}.`);
    files.set(path, Buffer.from(await response.arrayBuffer()));
  }
  return files;
}
function wait(milliseconds) { return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)); }
export async function checkPublicDeployment(input, options = {}) {
  const baseUrl = normalizeBaseUrl(input);
  const attempts = options.attempts ?? 24;
  const delayMs = options.delayMs ?? 5_000;
  const fetchImpl = options.fetchImpl ?? fetch;
  const expectedFiles = options.expectedFiles ?? await loadFilesFromDisk(options.rootDir);
  const expectedSummary = validatePublicationFiles(expectedFiles);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const deployedFiles = await fetchDeploymentFiles(baseUrl, fetchImpl);
      compareDeploymentFiles(expectedFiles, deployedFiles);
      return { baseUrl, attempt, ...validatePublicationFiles(deployedFiles) };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(delayMs);
    }
  }
  throw new Error(`O deploy não ficou íntegro após ${attempts} tentativas. Versão esperada: ${expectedSummary.contentVersion}. Último erro: ${lastError?.message ?? 'desconhecido'}`);
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  const publicUrl = process.argv[2] ?? process.env.PAGE_URL;
  checkPublicDeployment(publicUrl)
    .then((result) => console.log(JSON.stringify({ status: 'success', ...result })))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
