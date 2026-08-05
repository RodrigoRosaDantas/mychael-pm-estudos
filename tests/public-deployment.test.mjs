import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { checkPublicDeployment, compareDeploymentFiles, loadFilesFromDisk, normalizeBaseUrl, validatePublicationFiles } from '../scripts/check-public-deployment.mjs';
const rootDir = fileURLToPath(new URL('..', import.meta.url));
const expectedFiles = await loadFilesFromDisk(rootDir);
test('normaliza a URL pública sem perder o caminho do projeto', () => {
  assert.equal(normalizeBaseUrl('https://example.test/mychael-pm-estudos?cache=1#inicio'), 'https://example.test/mychael-pm-estudos/');
});
test('arquivos locais formam uma publicação íntegra', () => {
  const result = validatePublicationFiles(expectedFiles);
  assert.equal(result.contentVersion, 7);
  assert.equal(result.publicationStatus, 'published');
  assert.equal(result.units, 7);
  assert.equal(result.questions, 42);
});
test('detecta arquivo público desatualizado', () => {
  const deployedFiles = new Map(expectedFiles);
  deployedFiles.set('content/catalog.json', Buffer.from('{"contentVersion":0}'));
  assert.throws(() => compareDeploymentFiles(expectedFiles, deployedFiles), /Deploy desatualizado ou divergente em content\/catalog\.json/);
});
test('validação remota compara o deploy com o commit atual', async () => {
  const fetchImpl = async (input) => {
    const url = new URL(input);
    const path = url.pathname.replace('/mychael-pm-estudos/', '');
    const body = expectedFiles.get(path);
    return body ? new Response(body, { status: 200 }) : new Response('não encontrado', { status: 404 });
  };
  const result = await checkPublicDeployment('https://example.test/mychael-pm-estudos', { expectedFiles, fetchImpl, attempts: 1, delayMs: 0 });
  assert.equal(result.attempt, 1);
  assert.equal(result.units, 7);
  assert.equal(result.questions, 42);
});
test('validação remota falha quando o site não responde', async () => {
  const fetchImpl = async () => new Response('indisponível', { status: 503 });
  await assert.rejects(checkPublicDeployment('https://example.test/mychael-pm-estudos', { expectedFiles, fetchImpl, attempts: 1, delayMs: 0 }), /Falha HTTP 503/);
});
