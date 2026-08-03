import { createHash } from 'node:crypto';
import { validateCatalog } from './content-rules.mjs';

const COLLECTIONS = ['subjects', 'topics', 'sources', 'units', 'materials', 'questions', 'questionSets'];
const DIRECT_PUBLISHABLE = new Set(['unit', 'material', 'question', 'questionSet']);
const FORBIDDEN_KEYS = new Set([
  'email', 'password', 'phone', 'userId', 'studentAnswers', 'personalAnswers', 'grades', 'scores',
  'studyHistory', 'tafResults', 'deviceData', 'recoveryCodes', 'serviceRoleKey', 'notionToken',
  'privateKey', 'secret', 'accessToken', 'refreshToken'
]);

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)])
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(normalize(value));
}

export function sha256(value) {
  const input = typeof value === 'string' ? value : stableStringify(value);
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function scanForbidden(value, path = '$', errors = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(item, `${path}[${index}]`, errors));
    return errors;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) errors.push(`${path}.${key}: dado pessoal ou segredo proibido`);
      scanForbidden(child, `${path}.${key}`, errors);
    }
  }
  return errors;
}

function allRecords(snapshot) {
  return COLLECTIONS.flatMap((collection) =>
    (snapshot[collection] ?? []).map((record) => ({ ...record, collection }))
  );
}

function requireValue(record, field, blockers) {
  const value = record[field];
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
    blockers.push(`${record.id ?? '(sem ID)'}: campo obrigatório ausente: ${field}`);
  }
}

export function sourceFingerprint(record) {
  return sha256({
    id: record.id,
    type: record.type,
    notionPageId: record.notionPageId,
    version: record.version,
    lastEditedAt: record.lastEditedAt,
    editorialStatus: record.editorialStatus,
    publicationStatus: record.publicationStatus
  });
}

export function evaluateLot(snapshot) {
  const blockers = [];
  if (!snapshot || typeof snapshot !== 'object') return ['snapshot deve ser um objeto'];
  blockers.push(...scanForbidden(snapshot));

  const lot = snapshot.lot ?? {};
  for (const field of ['id', 'version', 'authorized', 'publicationStatus']) requireValue(lot, field, blockers);

  const records = allRecords(snapshot);
  const idMap = new Map();
  for (const record of records) {
    for (const field of ['id', 'type', 'notionPageId', 'version', 'lastEditedAt', 'editorialStatus', 'publicationStatus']) {
      requireValue(record, field, blockers);
    }
    if (record.id) {
      if (idMap.has(record.id)) blockers.push(`ID duplicado: ${record.id}`);
      idMap.set(record.id, record);
    }
    if (record.editorialStatus !== 'Aprovado') blockers.push(`${record.id}: estado editorial ${record.editorialStatus}`);
    if (DIRECT_PUBLISHABLE.has(record.type) && record.publicationStatus !== 'Fila de exportação') {
      blockers.push(`${record.id}: publicação deve estar em Fila de exportação`);
    }
  }

  const existingIds = new Set(records.map((record) => record.id));
  const relationFields = ['subjectId', 'topicIds', 'sourceIds', 'unitId', 'materialIds', 'questionIds', 'questionSetIds'];
  for (const record of records) {
    for (const field of relationFields) {
      const value = record[field];
      if (value == null) continue;
      const ids = Array.isArray(value) ? value : [value];
      for (const id of ids) {
        if (!existingIds.has(id)) blockers.push(`${record.id}: relação quebrada em ${field}: ${id}`);
      }
    }
  }

  for (const question of snapshot.questions ?? []) {
    for (const field of ['statement', 'options', 'answer', 'commentary', 'foundation', 'subjectId', 'topicIds', 'sourceIds']) {
      requireValue(question, field, blockers);
    }
    if (!Array.isArray(question.options) || question.options.length < 2) blockers.push(`${question.id}: alternativas incompletas`);
    if (question.answerVerified !== true) blockers.push(`${question.id}: gabarito não verificado`);
    if (question.sourceVerified !== true) blockers.push(`${question.id}: fonte não verificada`);
    if (question.complete !== true) blockers.push(`${question.id}: questão incompleta`);
    if (question.annulled === true) blockers.push(`${question.id}: questão anulada`);
    if (question.duplicate === true || question.duplicateOf) blockers.push(`${question.id}: questão duplicada`);
    if (question.imageRequired === true && question.imageValidated !== true) blockers.push(`${question.id}: imagem obrigatória não validada`);
  }

  if (lot.authorized !== true) blockers.push(`${lot.id ?? 'lote'}: publicação não autorizada por Rodrigo`);
  if (lot.publicationStatus !== 'Fila de exportação') blockers.push(`${lot.id ?? 'lote'}: lote não está em Fila de exportação`);

  if (snapshot.catalog) blockers.push(...validateCatalog(snapshot.catalog));
  else blockers.push('catálogo público ausente no snapshot');

  return [...new Set(blockers)].sort();
}

export function buildManifest(snapshot, generatedAt = new Date().toISOString()) {
  const blockers = evaluateLot(snapshot);
  const records = allRecords(snapshot)
    .map((record) => ({
      id: record.id,
      type: record.type,
      version: record.version,
      notionPageId: record.notionPageId,
      lastEditedAt: record.lastEditedAt,
      sha256: sourceFingerprint(record)
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const lotHash = sha256({
    lotId: snapshot.lot?.id,
    version: snapshot.lot?.version,
    recordHashes: records.map(({ id, sha256: digest }) => ({ id, sha256: digest })),
    blockers
  });

  return {
    schemaVersion: 1,
    generatedAt,
    lotId: snapshot.lot?.id ?? null,
    lotVersion: snapshot.lot?.version ?? null,
    status: blockers.length ? 'blocked' : 'ready',
    authorized: snapshot.lot?.authorized === true,
    recordCount: records.length,
    records,
    blockers,
    lotSha256: lotHash
  };
}

export function buildCatalog(snapshot) {
  const blockers = evaluateLot(snapshot);
  if (blockers.length) {
    const error = new Error(`Lote bloqueado:\n- ${blockers.join('\n- ')}`);
    error.blockers = blockers;
    throw error;
  }
  return normalize(snapshot.catalog);
}
