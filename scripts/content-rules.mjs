const ARRAY_KEYS = ['subjects','topics','sources','units','materials','questions','questionSets','tafRecords','previousExams'];
const FORBIDDEN_KEYS = new Set([
  'personalAnswers','studentAnswers','grades','scores','studyHistory','tafResults','deviceData',
  'recoveryCodes','serviceRoleKey','notionToken','privateKey','password','email','phone'
]);

function walk(value, path = '$', errors = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, errors));
    return errors;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key)) errors.push(`${path}.${key}: campo pessoal ou secreto proibido`);
      walk(child, `${path}.${key}`, errors);
    }
  }
  return errors;
}

export function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || typeof catalog !== 'object') return ['Catálogo deve ser um objeto JSON.'];
  if (catalog.schemaVersion !== 1) errors.push('schemaVersion deve ser 1.');
  if (catalog.studentProfileId !== 'STU-MYCHAEL') errors.push('studentProfileId inválido.');
  if (catalog.features?.essay !== false) errors.push('Redação deve permanecer desativada no MVP.');
  if (catalog.features?.taf !== true) errors.push('TAF deve permanecer ativo no MVP.');

  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(catalog[key])) errors.push(`${key} deve ser uma lista.`);
  }

  const allIds = new Map();
  for (const key of ARRAY_KEYS) {
    for (const item of catalog[key] ?? []) {
      if (!item.id || typeof item.id !== 'string') {
        errors.push(`${key}: registro sem ID permanente.`);
        continue;
      }
      if (allIds.has(item.id)) errors.push(`ID duplicado: ${item.id} (${allIds.get(item.id)} e ${key}).`);
      else allIds.set(item.id, key);
    }
  }

  for (const question of catalog.questions ?? []) {
    for (const field of ['statement','answer','commentary','foundation','sourceIds','subjectId','topicIds']) {
      if (question[field] == null || (Array.isArray(question[field]) && question[field].length === 0) || question[field] === '') {
        errors.push(`Questão ${question.id ?? '(sem ID)'} sem ${field}.`);
      }
    }
    if (question.annulled === true && question.valid === true) errors.push(`Questão ${question.id}: anulada não pode estar válida.`);
    if (question.duplicateOf && question.valid === true) errors.push(`Questão ${question.id}: duplicada não pode estar válida.`);
    if (question.imageRequired === true && !question.imageUrl) errors.push(`Questão ${question.id}: imagem necessária ausente.`);
  }

  for (const record of catalog.tafRecords ?? []) {
    if (record.temporalStatus === 'historical' && record.current === true) {
      errors.push(`TAF ${record.id}: índice histórico não pode ser marcado como vigente.`);
    }
    if (!record.sourceIds?.length) errors.push(`TAF ${record.id}: fonte ausente.`);
  }

  return [...errors, ...walk(catalog)];
}
