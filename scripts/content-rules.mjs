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
function requireRelation(errors, owner, field, values, validIds) {
if (!Array.isArray(values) || values.length === 0) {
errors.push(`${owner}: relação ${field} ausente.`);
return;
}
for (const id of values) {
if (!validIds.has(id)) errors.push(`${owner}: relação quebrada em ${field}: ${id}.`);
}
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
const subjectIds = new Set((catalog.subjects ?? []).map(({ id }) => id));
const topicIds = new Set((catalog.topics ?? []).map(({ id }) => id));
const sourceIds = new Set((catalog.sources ?? []).map(({ id }) => id));
const unitIds = new Set((catalog.units ?? []).map(({ id }) => id));
const materialIds = new Set((catalog.materials ?? []).map(({ id }) => id));
const questionIds = new Set((catalog.questions ?? []).map(({ id }) => id));
const questionSetIds = new Set((catalog.questionSets ?? []).map(({ id }) => id));
for (const topic of catalog.topics ?? []) {
if (!subjectIds.has(topic.subjectId)) errors.push(`${topic.id}: matéria inexistente: ${topic.subjectId}.`);
if (topic.parentId && !topicIds.has(topic.parentId)) errors.push(`${topic.id}: assunto pai inexistente: ${topic.parentId}.`);
}
for (const unit of catalog.units ?? []) {
if (!subjectIds.has(unit.subjectId)) errors.push(`${unit.id}: matéria inexistente: ${unit.subjectId}.`);
requireRelation(errors, unit.id, 'topicIds', unit.topicIds, topicIds);
requireRelation(errors, unit.id, 'sourceIds', unit.sourceIds, sourceIds);
requireRelation(errors, unit.id, 'materialIds', unit.materialIds, materialIds);
requireRelation(errors, unit.id, 'questionIds', unit.questionIds, questionIds);
requireRelation(errors, unit.id, 'questionSetIds', unit.questionSetIds, questionSetIds);
}
for (const material of catalog.materials ?? []) {
if (!unitIds.has(material.unitId)) errors.push(`${material.id}: unidade inexistente: ${material.unitId}.`);
if (!subjectIds.has(material.subjectId)) errors.push(`${material.id}: matéria inexistente: ${material.subjectId}.`);
requireRelation(errors, material.id, 'topicIds', material.topicIds, topicIds);
requireRelation(errors, material.id, 'sourceIds', material.sourceIds, sourceIds);
if (!Array.isArray(material.blocks) || material.blocks.length === 0) errors.push(`${material.id}: conteúdo teórico ausente.`);
}
for (const question of catalog.questions ?? []) {
for (const field of ['statement','answer','commentary','foundation','sourceIds','subjectId','topicIds']) {
if (question[field] == null || (Array.isArray(question[field]) && question[field].length === 0) || question[field] === '') {
errors.push(`Questão ${question.id ?? '(sem ID)'} sem ${field}.`);
}
}
if (!unitIds.has(question.unitId)) errors.push(`Questão ${question.id}: unidade inexistente: ${question.unitId}.`);
if (!subjectIds.has(question.subjectId)) errors.push(`Questão ${question.id}: matéria inexistente: ${question.subjectId}.`);
requireRelation(errors, question.id, 'topicIds', question.topicIds, topicIds);
requireRelation(errors, question.id, 'sourceIds', question.sourceIds, sourceIds);
if (!Array.isArray(question.options) || question.options.length < 2) errors.push(`Questão ${question.id}: alternativas incompletas.`);
else if (!question.options.some(({ id }) => id === question.answer)) errors.push(`Questão ${question.id}: gabarito não corresponde às alternativas.`);
if (question.annulled === true && question.valid === true) errors.push(`Questão ${question.id}: anulada não pode estar válida.`);
if (question.duplicateOf && question.valid === true) errors.push(`Questão ${question.id}: duplicada não pode estar válida.`);
if (question.imageRequired === true && !question.imageUrl) errors.push(`Questão ${question.id}: imagem necessária ausente.`);
}
for (const set of catalog.questionSets ?? []) {
if (!unitIds.has(set.unitId)) errors.push(`${set.id}: unidade inexistente: ${set.unitId}.`);
requireRelation(errors, set.id, 'questionIds', set.questionIds, questionIds);
}
for (const record of catalog.tafRecords ?? []) {
if (record.temporalStatus === 'historical' && record.current === true) {
errors.push(`TAF ${record.id}: índice histórico não pode ser marcado como vigente.`);
}
if (!record.sourceIds?.length) errors.push(`TAF ${record.id}: fonte ausente.`);
}
return [...errors, ...walk(catalog)];
}
