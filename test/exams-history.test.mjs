import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const allowedOfficialHosts = new Set([
  'goias.gov.br',
  'portal.pm.df.gov.br',
  'link.institutoaocp.org.br',
  'www.policiamilitar.mg.gov.br',
  'www.almg.gov.br'
]);

async function loadHistory() {
  return JSON.parse(await readFile(new URL('../content/exams-history.json', import.meta.url), 'utf8'));
}

test('acervo público de provas contém somente metadados históricos', async () => {
  const data = await loadHistory();
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.publicationStatus, 'published');
  assert.equal(data.scope, 'historical-metadata-only');
  assert.equal(data.exams.length, 4);

  const ids = data.exams.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length, 'IDs de provas devem ser únicos');
  assert.deepEqual(new Set(data.exams.map(({ corporation }) => corporation)), new Set(['PMGO', 'PMDF', 'PMMG']));

  for (const exam of data.exams) {
    assert.match(exam.id, /^(PMGO|PMDF|PMMG)-/);
    assert.ok(Number.isInteger(exam.questions) && exam.questions > 0);
    assert.equal(typeof exam.essay, 'boolean');
    assert.equal(exam.availability, 'Metadados históricos');
    assert.ok(exam.documentStatus.length > 20);
    assert.ok(Array.isArray(exam.officialLinks) && exam.officialLinks.length > 0);

    for (const source of exam.officialLinks) {
      const url = new URL(source.url);
      assert.equal(url.protocol, 'https:');
      assert.ok(allowedOfficialHosts.has(url.hostname), `Host não autorizado no acervo público: ${url.hostname}`);
    }
  }

  const serialized = JSON.stringify(data).toLowerCase();
  for (const forbidden of ['qconcursos', 'cloudfront', 'scribd', 'alternativa a', 'alternativa b', '"gabarito":', '"answers":', '"pdf":']) {
    assert.equal(serialized.includes(forbidden), false, `Conteúdo proibido no acervo público: ${forbidden}`);
  }
});

test('página de provas carrega o renderizador histórico separado', async () => {
  const html = await readFile(new URL('../provas.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../assets/exams-page.js', import.meta.url), 'utf8');
  assert.match(html, /assets\/exams-page\.js/);
  assert.match(script, /content\/exams-history\.json/);
  assert.match(script, /historical-metadata-only/);
  assert.doesNotMatch(script, /simulation_attempts|question_attempts|service_role/);
});
