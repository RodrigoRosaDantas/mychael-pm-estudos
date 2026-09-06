const JSON_RESOURCES = Object.freeze({
  applicability: './content/content-applicability.json',
  catalog: './content/catalog.json',
  curriculumMatrix: './content/curriculum-matrix.json',
  deployment: './content/deployment.json',
  examsHistory: './content/exams-history.json',
  manifest: './content/manifest.json',
  studyCycle: './content/study-cycle-v1.json',
  tafHistory: './content/taf-pmmg-historical.json'
});

const pending = new Map();

export function loadJsonResource(url, label = 'Recurso') {
  const key = String(url);
  if (!pending.has(key)) {
    const request = fetch(key, {
      cache: 'no-cache',
      headers: { accept: 'application/json' }
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`${label} indisponível (${response.status}).`);
        return response.json();
      })
      .catch((error) => {
        pending.delete(key);
        throw error;
      });
    pending.set(key, request);
  }
  return pending.get(key);
}

export const loadApplicability = () => loadJsonResource(JSON_RESOURCES.applicability, 'Camada de aplicabilidade');
export const loadCatalog = () => loadJsonResource(JSON_RESOURCES.catalog, 'Catálogo');
export const loadCurriculumMatrix = () => loadJsonResource(JSON_RESOURCES.curriculumMatrix, 'Matriz curricular');
export const loadDeploymentMetadata = () => loadJsonResource(JSON_RESOURCES.deployment, 'Metadados do deploy');
export const loadExamsHistory = () => loadJsonResource(JSON_RESOURCES.examsHistory, 'Acervo histórico');
export const loadManifest = () => loadJsonResource(JSON_RESOURCES.manifest, 'Manifesto');
export const loadStudyCycle = () => loadJsonResource(JSON_RESOURCES.studyCycle, 'Cronograma inicial');
export const loadTafHistory = () => loadJsonResource(JSON_RESOURCES.tafHistory, 'TAF histórico');
