/**
 * schema.js - model de dades, valors per defecte, fàbriques d'entitats
 * i migració no destructiva entre versions d'esquema.
 */
import { uid } from '../core/util.js';
import { today, schoolYear, nowStamp } from '../core/dates.js';

export const APP_VERSION = '1.2.1';

/** Autoria i procedència de l'aplicació, per al peu i la secció «Quant a». */
export const APP_AUTHOR = 'Víctor Moreno de la Torre';
export const APP_YEAR = 2026;
export const APP_LICENSE = 'MIT';
export const APP_REPO = 'https://github.com/vmoren12/seguiment';
export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'seguiment.v1';

/** Col·leccions d'entitats presents a l'estat (ordre d'importació). */
export const COLLECTIONS = [
  'students', 'guardians', 'staff', 'services', 'serviceLinks',
  'records', 'appointments', 'tasks', 'demands', 'referrals', 'consents',
];

/** Tipus de registre integrats. Es poden ampliar des de la configuració. */
export const RECORD_TYPES = [
  'entrevistaFamilia', 'entrevistaAlumne', 'coordinacioDocent', 'coordinacioExtern',
  'observacioAula', 'provaInstrument', 'derivacio', 'incidencia', 'cad',
  'tutoriaIndividual', 'altres',
];

/** Colors sobris per als tipus de cita (mai saturats). */
export const DEFAULT_APPOINTMENT_TYPES = [
  { id: 'entrevistaFamilia', color: '#5a7d8c' },
  { id: 'entrevistaAlumne', color: '#6b7f5a' },
  { id: 'coordinacioDocent', color: '#8a7a5c' },
  { id: 'coordinacioExtern', color: '#7a6a8c' },
  { id: 'observacioAula', color: '#5c8079' },
  { id: 'avaluacio', color: '#8c6a63' },
  { id: 'cad', color: '#6a6a72' },
  { id: 'altres', color: '#7d7d78' },
];

/** Plantilles de contingut per tipus de registre (editables a la configuració). */
export const DEFAULT_TEMPLATES = {
  entrevistaFamilia: 'Motiu de l’entrevista:\n\nInformació aportada per la família:\n\nInformació aportada pel centre:\n\nAcords:\n\nPropera revisió:',
  entrevistaAlumne: 'Motiu:\n\nContingut de la conversa:\n\nValoració:\n\nAcords amb l’alumne/a:',
  coordinacioDocent: 'Assistents:\n\nSituació actual a l’aula:\n\nMesures acordades:\n\nSeguiment previst:',
  coordinacioExtern: 'Servei i professional:\n\nInformació compartida:\n\nInformació rebuda:\n\nAcords i propera coordinació:',
  observacioAula: 'Context de l’observació (àrea, moment, durada):\n\nConducta observada:\n\nResposta a les mesures aplicades:\n\nOrientacions al professorat:',
  provaInstrument: 'Instrument aplicat:\n\nCondicions d’aplicació:\n\nResultats:\n\nInterpretació i orientacions:',
  derivacio: 'Servei de destí:\n\nMotiu de la derivació:\n\nDocumentació enviada:\n\nConsentiment familiar:',
  incidencia: 'Fets:\n\nPersones implicades:\n\nActuacions immediates:\n\nComunicacions realitzades:',
  cad: 'Casos tractats:\n\nValoració de la comissió:\n\nMesures acordades:\n\nResponsables i terminis:',
  tutoriaIndividual: 'Objectiu del seguiment:\n\nEvolució des de l’última sessió:\n\nTreball realitzat:\n\nCompromisos:',
  altres: '',
};

/** Catàleg normatiu inicial del sistema educatiu català. */
export const DEFAULT_NORMATIVE = [
  { id: 'n1', ref: 'Decret 150/2017', title: 'Atenció educativa a l’alumnat en el marc d’un sistema educatiu inclusiu' },
  { id: 'n2', ref: 'Decret 175/2022', title: 'Ordenació dels ensenyaments de l’educació bàsica' },
  { id: 'n3', ref: 'Decret 119/2015', title: 'Ordenació dels ensenyaments de l’educació primària' },
  { id: 'n4', ref: 'Resolució d’inici de curs', title: 'Documents per a l’organització i la gestió dels centres' },
  { id: 'n5', ref: 'Protocol d’assetjament', title: 'Protocol de prevenció, detecció i intervenció davant l’assetjament entre iguals' },
  { id: 'n6', ref: 'Protocol d’absentisme', title: 'Protocol de prevenció, detecció i intervenció davant l’absentisme escolar' },
  { id: 'n7', ref: 'LOPDGDD 3/2018', title: 'Protecció de dades personals i garantia dels drets digitals' },
];

/** Banc de frases inicial, ampliable per l'usuari. */
export const DEFAULT_PHRASES = [
  { id: 'f1', category: 'Família', text: 'La família es mostra receptiva i col·laboradora amb les orientacions del centre.' },
  { id: 'f2', category: 'Família', text: 'S’acorda mantenir una comunicació quinzenal per mitjà de l’agenda.' },
  { id: 'f3', category: 'Aula', text: 'Es constata una millora en la resposta a les mesures universals aplicades a l’aula.' },
  { id: 'f4', category: 'Aula', text: 'Es recomana mantenir els suports i revisar-ne l’eficàcia al final del trimestre.' },
  { id: 'f5', category: 'Derivació', text: 'Es proposa derivació a l’EAP per a la valoració psicopedagògica, amb consentiment familiar previ.' },
  { id: 'f6', category: 'Seguiment', text: 'Es fixa una nova revisió del cas d’aquí a tres mesos.' },
];

/** Nivells educatius per defecte (primària i secundària). */
export const DEFAULT_LEVELS = ['1r EI', '2n EI', '3r EI', '1r EP', '2n EP', '3r EP', '4t EP', '5è EP', '6è EP', '1r ESO', '2n ESO', '3r ESO', '4t ESO'];

/** Edat teòrica d'inici de cada nivell, per suggerir el curs previst. */
export const LEVEL_AGES = {
  '1r EI': 3, '2n EI': 4, '3r EI': 5,
  '1r EP': 6, '2n EP': 7, '3r EP': 8, '4t EP': 9, '5è EP': 10, '6è EP': 11,
  '1r ESO': 12, '2n ESO': 13, '3r ESO': 14, '4t ESO': 15,
};

/** Passos preceptius de la cadena documental del cas. */
export const CHAIN_STEPS = [
  'demanda', 'informacio', 'consentiment', 'valoracio', 'decisio',
  'comunicacio', 'derivacio', 'seguiment', 'revisio', 'tancament',
];

/** Configuració per defecte. */
export function defaultSettings() {
  return {
    lang: 'ca',
    theme: 'auto',
    autosave: true,
    presentation: false,
    centre: {
      name: '', code: '', address: '',
      schoolYear: schoolYear(),
      professional: '', role: 'orientacio',
    },
    levels: [...DEFAULT_LEVELS],
    groups: [],
    calendar: {
      dayStart: '08:00',
      dayEnd: '18:00',
      slotMinutes: 45,
      availability: [
        { id: 'a1', day: 1, from: '08:00', to: '14:00' },
        { id: 'a2', day: 2, from: '08:00', to: '14:00' },
        { id: 'a3', day: 3, from: '08:00', to: '14:00' },
        { id: 'a4', day: 4, from: '08:00', to: '14:00' },
        { id: 'a5', day: 5, from: '08:00', to: '14:00' },
      ],
    },
    appointmentTypes: DEFAULT_APPOINTMENT_TYPES.map((x) => ({ ...x })),
    recordTypes: [...RECORD_TYPES],
    templates: { ...DEFAULT_TEMPLATES },
    phrases: DEFAULT_PHRASES.map((x) => ({ ...x })),
    normative: DEFAULT_NORMATIVE.map((x) => ({ ...x })),
    thresholds: {
      noContactDays: 45,
      sealDays: 30,
      piWarnDays: 30,
      backupDays: 14,
    },
    lastBackupAt: '',
    lockEnabled: false,
  };
}

/** Estat inicial complet i buit. */
export function defaultState() {
  const state = {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    createdAt: nowStamp(),
    updatedAt: nowStamp(),
    settings: defaultSettings(),
  };
  COLLECTIONS.forEach((c) => { state[c] = []; });
  return state;
}

const base = (prefix) => ({ id: uid(prefix), createdAt: nowStamp(), updatedAt: nowStamp() });

/** Alumne/a. */
export function newStudent(patch = {}) {
  return {
    ...base('al'),
    name: '', surname: '', birth: '', gender: 'noConsta',
    level: '', group: '',
    tutors: [],            // tutors/es del grup: en poden ser més d'un
    tutorIndividual: '',   // tutor/a de la tutoria individualitzada
    originCentre: '', enrolled: today(),
    academic: { repeats: 0, pendingSubjects: '', attendance: '' },
    nese: {
      category: 'cap',
      report: { has: false, date: '', ref: '' },
      measures: [],
      pi: { has: false, approved: '', review: '' },
      siei: false, sial: false,
    },
    health: { diagnoses: [], medication: '', allergies: '', notes: '' },
    family: { structure: '', siblings: '', socialServices: false, homeLanguage: '' },
    status: { value: 'actiu', date: today(), reason: '' },
    tags: [],
    notes: '',
    annulled: null,
    ...patch,
  };
}

/** Referent familiar vinculat a un alumne/a. */
export function newGuardian(patch = {}) {
  return {
    ...base('rf'),
    studentId: '', name: '', kinship: 'mare', phone: '', email: '',
    language: 'ca', custody: '', availability: '', notes: '',
    annulled: null,
    ...patch,
  };
}

/** Professional intern del centre. */
export function newStaff(patch = {}) {
  return { ...base('pi'), name: '', role: 'tutor', email: '', phone: '', notes: '', annulled: null, ...patch };
}

/** Servei o entitat externa, reutilitzable entre alumnes. */
export function newService(patch = {}) {
  return {
    ...base('sv'),
    name: '', kind: 'eap', contact: '', phone: '', email: '',
    frequency: '', startedAt: '', endedAt: '', notes: '', annulled: null,
    ...patch,
  };
}

/** Vinculació N:M entre alumne i servei. */
export function newServiceLink(patch = {}) {
  return { ...base('sl'), studentId: '', serviceId: '', role: '', linkedAt: today(), endedAt: '', notes: '', annulled: null, ...patch };
}

/** Registre de seguiment: nucli operatiu i unitat de traçabilitat. */
export function newRecord(patch = {}) {
  return {
    ...base('rg'),
    studentIds: [],
    at: '', // instant 'AAAA-MM-DDTHH:MM'
    type: 'entrevistaFamilia',
    participants: [],
    content: '',
    agreements: [], // { id, text, owner, due, state }
    confidentiality: 'visible',
    author: '',
    serviceId: '',
    appointmentId: '',
    demandId: '',
    normativeId: '',
    sealed: false,
    versions: [], // { at, author, reason, snapshot }
    annulled: null,
    ...patch,
  };
}

/** Cita del calendari. */
export function newAppointment(patch = {}) {
  return {
    ...base('ct'),
    start: '', end: '',
    type: 'entrevistaFamilia',
    studentIds: [],
    attendees: [],
    serviceId: '',
    modality: 'presencial',
    location: '',
    state: 'programada',
    cancelReason: '',
    reminderMinutes: 0,
    notes: '',
    recordId: '',
    seriesId: '',
    seriesRule: '',
    annulled: null,
    ...patch,
  };
}

/** Tasca derivada d'un acord, d'una revisió preceptiva o creada manualment. */
export function newTask(patch = {}) {
  return {
    ...base('tk'),
    title: '', studentId: '', owner: '', due: '',
    state: 'pendent', doneAt: '',
    origin: { kind: 'manual', refId: '' },
    notes: '', annulled: null,
    ...patch,
  };
}

/** Demanda rebuda. */
export function newDemand(patch = {}) {
  return {
    ...base('dm'),
    studentId: '', origin: 'tutor', receivedAt: today(), motive: '',
    urgency: 'mitjana', assignedTo: '', firstActionAt: '',
    state: 'rebuda', notes: '', annulled: null,
    ...patch,
  };
}

/** Derivació a un servei extern. */
export function newReferral(patch = {}) {
  return {
    ...base('dv'),
    studentId: '', serviceId: '', serviceName: '', motive: '',
    requestedAt: today(), sentDocs: '', consentId: '',
    state: 'preparacio', response: '', resolvedAt: '',
    notes: '', annulled: null,
    ...patch,
  };
}

/** Consentiment informat. */
export function newConsent(patch = {}) {
  return {
    ...base('cs'),
    studentId: '', type: 'avaluacio', scope: '', obtainedAt: today(),
    via: 'signatura', validUntil: '', document: '',
    revoked: null, notes: '', annulled: null,
    ...patch,
  };
}

/** Acord dins d'un registre. */
export function newAgreement(patch = {}) {
  return { id: uid('ac'), text: '', owner: '', due: '', state: 'pendent', ...patch };
}

/**
 * Migració no destructiva. Cada pas rep l'estat i el retorna actualitzat.
 * Els passos futurs s'afegeixen a MIGRATIONS amb la versió de destinació.
 */
const MIGRATIONS = {
  // Un alumne/a pot tenir més d'un tutor/a de grup i, a més, un tutor/a
  // individual. El camp únic `tutorName` passa a ser el primer de la llista.
  2: (state) => {
    (state.students || []).forEach((s) => {
      if (!Array.isArray(s.tutors)) s.tutors = s.tutorName ? [s.tutorName] : [];
      if (typeof s.tutorIndividual !== 'string') s.tutorIndividual = '';
      delete s.tutorName;
      delete s.tutorId;
    });
    state.schemaVersion = 2;
    return state;
  },
};

/** Aplica les migracions pendents i completa els camps que faltin. */
export function migrate(raw) {
  let state = raw && typeof raw === 'object' ? raw : {};
  let version = Number(state.schemaVersion) || 0;

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version + 1];
    if (!step) { version = SCHEMA_VERSION; break; }
    state = step(state);
    version = Number(state.schemaVersion) || version + 1;
  }

  const fallback = defaultState();
  const merged = {
    ...fallback,
    ...state,
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    settings: mergeSettings(fallback.settings, state.settings),
  };
  COLLECTIONS.forEach((c) => { merged[c] = Array.isArray(state[c]) ? state[c] : []; });
  // Els magatzems antics podien portar un registre d'auditoria: es descarta.
  delete merged.audit;
  return merged;
}

/** Fusiona la configuració desada amb els valors per defecte, en profunditat. */
export function mergeSettings(defaults, saved) {
  if (!saved || typeof saved !== 'object') return defaults;
  const out = { ...defaults };
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) continue;
    const def = defaults[key];
    if (Array.isArray(def)) out[key] = Array.isArray(value) ? value : def;
    else if (def && typeof def === 'object' && value && typeof value === 'object') out[key] = mergeSettings(def, value);
    else out[key] = value;
  }
  return out;
}

/** Validació mínima d'un fitxer importat. Llança un error descriptiu. */
export function validateImport(data) {
  if (!data || typeof data !== 'object') throw new Error('el contingut no és un objecte JSON');
  if (!('schemaVersion' in data)) throw new Error('falta el camp schemaVersion');
  if (Number(data.schemaVersion) > SCHEMA_VERSION) {
    throw new Error(`l’esquema ${data.schemaVersion} és més recent que el suportat (${SCHEMA_VERSION})`);
  }
  const missing = COLLECTIONS.filter((c) => c in data && !Array.isArray(data[c]));
  if (missing.length) throw new Error(`les col·leccions ${missing.join(', ')} no són llistes`);
  return true;
}
