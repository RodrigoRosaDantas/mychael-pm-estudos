import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkPublicDeployment, compareDeploymentFiles, loadFilesFromDisk, normalizeBaseUrl, validatePublicationFiles } from '../scripts/check-public-deployment.mjs';
const rootDir = fileURLToPath(new URL('..', import.meta.url));
const expectedFiles = await loadFilesFromDisk(rootDir);
test('normaliza a URL pública sem perder o caminho do projeto', () => { assert.equal(normalizeBaseUrl('https://example.test/mychael-pm-estudos?cache=1#inicio'), 'https://example.test/mychael-pm-estudos/'); });
test('arquivos locais formam uma publicação íntegra e multi-concurso', () => {
  const result = validatePublicationFiles(expectedFiles);
  assert.equal(result.contentVersion, 48); assert.equal(result.publicationStatus, 'published'); assert.equal(result.pages, 12); assert.equal(result.units, 48); assert.equal(result.questions, 329);
  assert.equal(result.coverage.unitCounts.PMDF, 44); assert.equal(result.coverage.unitCounts.PMGO, 35); assert.equal(result.coverage.unitCounts.PMMG, 31); assert.equal(result.coverage.questionCounts.PMDF, 301); assert.equal(result.coverage.questionCounts.PMGO, 238); assert.equal(result.coverage.questionCounts.PMMG, 211); assert.equal(result.coverage.commonUnits, 19); assert.equal(result.coverage.specificRotationEnabled, false); assert.equal(result.coverage.pmmgTopicReviewPending, 0); assert.deepEqual(result.coverage.unclassifiedUnits, []);
});
test('detecta arquivo público desatualizado', () => { const deployedFiles=new Map(expectedFiles); deployedFiles.set('content/catalog.json',Buffer.from('{"contentVersion":0}')); assert.throws(()=>compareDeploymentFiles(expectedFiles,deployedFiles),/Deploy desatualizado ou divergente em content\/catalog\.json/); });
test('detecta camada de aplicabilidade pública desatualizada', () => { const deployedFiles=new Map(expectedFiles); deployedFiles.set('content/content-applicability.json',Buffer.from('{"schemaVersion":0,"unitApplicability":[]}')); assert.throws(()=>compareDeploymentFiles(expectedFiles,deployedFiles),/Deploy desatualizado ou divergente em content\/content-applicability\.json/); });
test('validação remota compara o deploy completo com o commit atual', async () => {
  const fetchImpl=async(input)=>{const url=new URL(input); const path=url.pathname.replace('/mychael-pm-estudos/',''); const body=expectedFiles.get(path); return body?new Response(body,{status:200}):new Response('não encontrado',{status:404});};
  const result=await checkPublicDeployment('https://example.test/mychael-pm-estudos',{expectedFiles,fetchImpl,attempts:1,delayMs:0});
  assert.equal(result.attempt,1); assert.equal(result.pages,12); assert.equal(result.units,48); assert.equal(result.questions,329); assert.equal(result.coverage.questionCounts.PMDF,301); assert.equal(result.coverage.questionCounts.PMGO,238); assert.equal(result.coverage.questionCounts.PMMG,211); assert.equal(result.coverage.specificRotationEnabled,false);
});
test('validação remota falha quando o site não responde', async () => { const fetchImpl=async()=>new Response('indisponível',{status:503}); await assert.rejects(checkPublicDeployment('https://example.test/mychael-pm-estudos',{expectedFiles,attempts:1,delayMs:0,fetchImpl}),/Falha HTTP 503/); });
