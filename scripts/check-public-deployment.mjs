import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REQUIRED_DEPLOYMENT_PATHS = Object.freeze([
  'index.html',
  'assets/app.js',
  'assets/styles.css',
  'assets/progress-panels.js',
  'assets/progress-panels.css',
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
  for (const path of REQUIRED_DEPLOYMENT_PATHS) {
    assert(files.has(path), `Arquivo obrigatório ausente: ${path}`);
  }

  const index = toBuffer(files.get('index.html')).toString('utf8');
  const app = toBuffer(files.get('assets/app.js')).toString('utf8');
  const styles = toBuffer(files.get('assets/styles.css')).toString('utf8');
  const progressPanels = toBuffer(files.get('assets/progress-panels.js')).toString('utf8');
  const progressStyles = toBuffer(files.get('assets/progress-panels.css')).toString('utf8');
  const catalogBuffer = toBuffer(files.get('content/catalog.json'));
  const manifestBuffer = toBuffer(files.get('content/manifest.json'));

  assert(index.includes('id="publicationBadge"'), 'A página não contém o indicador de publicação.');
  assert(index.includes('id="unitWorkspace"'), 'A página não contém a área da unidade.');
  assert(index.includes('id="questionWorkspace"'), 'A página não contém a área de questões.');
  assert(index.includes('id="reviewWorkspace"'), 'A página não contém a área de revisões.');
  assert(index.includes('id="errorWorkspace"'), 'A página não contém o caderno de erros.');
  assert(index.includes('id="performanceWorkspace"'), 'A página não contém o painel de desempenho.');
  assert(index.includes('./assets/progress-panels.js'), 'A página não carrega os painéis privados.');
  assert(app.includes('renderQuestions'), 'O JavaScript não contém a experiência de questões.');
  assert(app.includes('saveQuestionAttempt'), 'O JavaScript não contém o registro de tentativas.');
  assert(styles.includes('.question-card'), 'O CSS não contém o componente de questão.');
  assert(progressPanels.includes("from('review_items')"), 'O módulo não consulta as revisões privadas.');
  assert(progressPanels.includes("from('error_items')"), 'O módulo não consulta o caderno de erros.');
  assert(progressPanels.includes("from('question_attempts')"), 'O módulo não consulta as tentativas.');
  assert(progressPanels.includes("from('study_units')"), 'O módulo não consulta o progresso das unidades.');
  assert(!/signUp\s*\(|service_role|sb_secret_/i.test(progressPanels), 'O módulo privado contém cadastro ou segredo elevado.');
  assert(progressStyles.includes('.private-panel'), 'O CSS não contém os painéis privados.');

  const catalog = JSON.parse(catalogBuffer.toString('utf8'));
  const manifest = JSON.parse(manifestBuffer.toString('utf8'));
  const catalogEntry = manifest.files?.find(({ path }) => path === 'content/catalog.json');

  assert(catalogEntry, 'O manifesto não referencia content/catalog.json.');
  assert(manifest.contentVersion === catalog.contentVersion, 'Versões do catálogo e do manifesto divergem.');
  assert(catalogEntry.sha256 === sha256(catalogBuffer), 'O SHA-256 do catálogo não confere com o manifesto.');
  assert(catalogEntry.bytes === catalogBuffer.byteLength, 'O tamanho do catálogo não confere com o manifesto.');
  assert(Array.isArray(catalog.units), 'O catálogo não possui a coleção de unidades.');
  assert(Array.isArray(catalog.questions), 'O catálogo não possui a coleção de questões.');

  return {
    contentVersion: catalog.contentVersion,
    publicationStatus: catalog.publicationStatus,
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
    assert(
      expectedSha === deployedSha,
      `Deploy desatualizado ou divergente em ${path}: esperado ${expectedSha}, recebido ${deployedSha}.`
    );
  }
}

export async function loadFilesFromDisk(rootDir = process.cwd()) {
  const files = new Map();
  for (const path of REQUIRED_DEPLOYMENT_PATHS) {
    files.set(path, await readFile(resolve(rootDir, path)));
  }
  return files;
}

export async function fetchDeploymentFiles(baseUrl, fetchImpl = fetch) {
  const files = new Map();
  for (const path of REQUIRED_DEPLOYMENT_PATHS) {
    const url = new URL(path, baseUrl);
    const response = await fetchImpl(url, {
      cache: 'no-store',
      headers: {
        accept: path.endsWith('.json') ? 'application/json' : '*/*',
        'cache-control': 'no-cache'
      }
    });
    assert(response.ok, `Falha HTTP ${response.status} ao consultar ${url}.`);
    files.set(path, Buffer.from(await response.arrayBuffer()));
  }
  return files;
}

function wait(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

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
      const deployedSummary = validatePublicationFiles(deployedFiles);
      return { baseUrl, attempt, ...deployedSummary };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(delayMs);
    }
  }

  throw new Error(
    `O deploy não ficou íntegro após ${attempts} tentativas. ` +
    `Versão esperada: ${expectedSummary.contentVersion}. Último erro: ${lastError?.message ?? 'desconhecido'}`
  );
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const publicUrl = process.argv[2] ?? process.env.PAGE_URL;
  checkPublicDeployment(publicUrl)
    .then((result) => {
      console.log(JSON.stringify({ status: 'success', ...result }));
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
