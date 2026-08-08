import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'content', 'taf-pmmg-historical.json');
const modulePath = path.join(root, 'assets', 'taf-historical-references.js');
const htmlPath = path.join(root, 'taf.html');

const payload = JSON.parse(await readFile(dataPath, 'utf8'));
const moduleSource = await readFile(modulePath, 'utf8');
const html = await readFile(htmlPath, 'utf8');

if (payload.schemaVersion !== 1) throw new Error('TAF PMMG: schemaVersion inválida.');
if (payload.scope !== 'PMMG') throw new Error('TAF PMMG: escopo deve ser PMMG.');
if (payload.temporalStatus !== 'Histórico') throw new Error('TAF PMMG: referência pública deve permanecer histórica.');
if (payload.currentIndexAvailable !== false) throw new Error('TAF PMMG: índice vigente não pode ser presumido.');
if (payload.autoApplicableNextEdital !== false) throw new Error('TAF PMMG: referência histórica não pode ser autoaplicável ao próximo edital.');
if (payload.source?.id !== 'FNT-0025' || payload.source?.official !== false) {
  throw new Error('TAF PMMG: fonte secundária histórica deve permanecer explicitamente não oficial.');
}
if (!Array.isArray(payload.records) || payload.records.length !== 7) {
  throw new Error('TAF PMMG: esperados exatamente 7 registros históricos auditados.');
}

const ids = new Set();
for (const record of payload.records) {
  for (const field of ['id', 'kind', 'test', 'sex', 'criterion', 'temporalStatus', 'sourceIds']) {
    if (record[field] == null || record[field] === '' || (Array.isArray(record[field]) && record[field].length === 0)) {
      throw new Error(`${record.id ?? '(sem ID)'}: campo obrigatório ausente: ${field}`);
    }
  }
  if (ids.has(record.id)) throw new Error(`TAF PMMG: ID duplicado ${record.id}.`);
  ids.add(record.id);
  if (record.temporalStatus !== 'Histórico' || record.current !== false || record.autoApplicableNextEdital !== false) {
    throw new Error(`${record.id}: referência histórica com estado de vigência inválido.`);
  }
  if (!record.sourceIds.includes('FNT-0025')) throw new Error(`${record.id}: rastreabilidade FNT-0025 ausente.`);
}

for (const requiredId of [
  'TAF-R003',
  'TAF-PMMG-A01',
  'TAF-PMMG-M01',
  'TAF-PMMG-F01',
  'TAF-PMMG-M02',
  'TAF-PMMG-F02',
  'TAF-PMMG-A02'
]) {
  if (!ids.has(requiredId)) throw new Error(`TAF PMMG: registro esperado ausente: ${requiredId}.`);
}

if (!html.includes('./assets/taf-historical-references.js')) {
  throw new Error('taf.html: módulo de referências históricas PMMG ausente.');
}
if (!moduleSource.includes('./content/taf-pmmg-historical.json')) {
  throw new Error('TAF PMMG: módulo não carrega o artefato histórico validado.');
}
if (!moduleSource.includes('Não são índices vigentes') || !moduleSource.includes('cópia integral secundária auditada')) {
  throw new Error('TAF PMMG: alertas de vigência e origem da fonte ausentes.');
}

console.log('TAF PMMG histórico válido: 7 registros, fonte secundária sinalizada e zero autoaplicação futura.');
