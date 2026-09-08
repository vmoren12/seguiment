/**
 * demo.js - joc de dades d'exemple per provar l'aplicació sense dades reals.
 * Tots els noms són ficticis.
 */
import * as store from '../core/store.js';
import {
  newStudent, newGuardian, newService, newServiceLink, newRecord,
  newAppointment, newDemand, newReferral, newConsent, newStaff, newAgreement,
} from './schema.js';
import {
  today, toISODate, addDays, addMinutes, schoolYear, schoolYearRange, daysSince,
} from '../core/dates.js';

const NAMES = [
  ['Aina', 'Puig Serra', 'femeni'], ['Marc', 'Vidal Roca', 'masculi'],
  ['Nerea', 'Camps Oliver', 'femeni'], ['Ibrahim', 'Diallo Camara', 'masculi'],
  ['Laia', 'Ferrer Mas', 'femeni'], ['Pol', 'Soler Riu', 'masculi'],
  ['Yasmin', 'El Amrani', 'femeni'], ['Guillem', 'Costa Pla', 'masculi'],
  ['Júlia', 'Bosch Marí', 'femeni'], ['Nil', 'Gomila Font', 'masculi'],
  ['Ariadna', 'Prat Colomer', 'femeni'], ['Èric', 'Sala Bonet', 'masculi'],
];

const LEVELS = ['4t EP', '5è EP', '6è EP', '1r ESO', '2n ESO'];
const GROUPS = ['4t A', '5è A', '6è B', '1r ESO A', '2n ESO B'];
const TUTORS = ['Marta Ribas', 'Jordi Alsina', 'Carme Nogué', 'Xavier Puyol', 'Elena Grau'];
const NESE = ['cap', 'nee', 'trastornAprenentatge', 'socioeconomic', 'altesCapacitats', 'incorporacioTardana'];

const pick = (list, index) => list[index % list.length];

/** Carrega el joc de dades d'exemple sobre l'estat actual. */
export function loadDemoData() {
  const base = today();

  // Les actuacions es reparteixen dins del curs escolar actiu perquè les
  // estadístiques del període tinguin contingut des del primer moment.
  const year = schoolYear();
  const yearStart = schoolYearRange(year).from;
  const elapsed = Math.max(1, daysSince(yearStart) ?? 1);
  /** Data dins del curs, on 0 és l'inici i 1 és avui. */
  const dayIn = (fraction) => toISODate(addDays(yearStart, Math.round(Math.max(0, Math.min(1, fraction)) * elapsed)));

  const staff = TUTORS.map((name, i) => newStaff({ name, role: i === 4 ? 'coordinacio' : 'tutor' }));

  const services = [
    newService({ name: 'EAP B-17', kind: 'eap', contact: 'Roser Aymerich', phone: '937000001', frequency: 'Quinzenal' }),
    newService({ name: 'CSMIJ Comarcal', kind: 'csmij', contact: 'Dr. Enric Vila', phone: '937000002', frequency: 'Mensual' }),
    newService({ name: 'Serveis Socials Municipals', kind: 'serveisSocials', contact: 'Anna Bonvehí', phone: '937000003', frequency: 'Trimestral' }),
    newService({ name: 'Logopèdia Fonema', kind: 'logopedia', contact: 'Sílvia Roca', phone: '937000004', frequency: 'Setmanal' }),
  ];

  const students = NAMES.map((n, i) => {
    const age = 9 + (i % 5);
    const hasPi = i % 3 === 0;
    return newStudent({
      name: n[0],
      surname: n[1],
      gender: n[2],
      birth: toISODate(addDays(base, -(age * 365 + i * 11))),
      level: pick(LEVELS, i),
      group: pick(GROUPS, i),
      tutorName: pick(TUTORS, i),
      enrolled: toISODate(addDays(base, -(120 + i * 9))),
      nese: {
        category: pick(NESE, i),
        report: { has: i % 4 === 0, date: i % 4 === 0 ? toISODate(addDays(base, -200)) : '', ref: i % 4 === 0 ? `EAP/${2025 + (i % 2)}/${100 + i}` : '' },
        pi: {
          has: hasPi,
          approved: hasPi ? toISODate(addDays(base, -150)) : '',
          review: hasPi ? toISODate(addDays(base, (i % 4) * 30 - 30)) : '',
        },
        measures: hasPi ? [
          { id: `m${i}a`, text: 'Suport dins l’aula en àrees instrumentals', type: 'addicional', date: toISODate(addDays(base, -140)), normativeId: 'n1' },
          { id: `m${i}b`, text: 'Adaptació de materials i temps a les proves', type: 'universal', date: toISODate(addDays(base, -140)), normativeId: 'n1' },
        ] : [],
        siei: false,
        sial: false,
      },
      health: {
        diagnoses: i % 5 === 0 ? [{ id: `d${i}`, text: 'TDAH', pro: 'CSMIJ Comarcal', date: toISODate(addDays(base, -300)) }] : [],
        medication: '', allergies: '', notes: '',
      },
      family: {
        structure: i % 3 === 0 ? 'monoparental' : 'nuclear',
        siblings: String(i % 3),
        homeLanguage: i % 4 === 0 ? 'àrab' : 'català',
        socialServices: i % 6 === 0,
      },
      status: { value: i % 7 === 0 ? 'seguiment' : 'actiu', date: base, reason: '' },
    });
  });

  const guardians = students.flatMap((s, i) => [
    newGuardian({
      studentId: s.id, name: `Mare de ${s.name}`, kinship: 'mare',
      phone: `6000000${String(i).padStart(2, '0')}`, email: '', language: 'ca',
      availability: 'Tardes a partir de les 17 h',
    }),
    ...(i % 2 === 0 ? [newGuardian({
      studentId: s.id, name: `Pare de ${s.name}`, kinship: 'pare',
      phone: `6100000${String(i).padStart(2, '0')}`, language: 'ca',
    })] : []),
  ]);

  const serviceLinks = students
    .filter((_, i) => i % 2 === 0)
    .map((s, i) => newServiceLink({
      studentId: s.id,
      serviceId: pick(services, i).id,
      role: 'Seguiment del cas',
      linkedAt: dayIn(0.05 + (i % 5) * 0.05),
    }));

  const recordTypes = ['entrevistaFamilia', 'coordinacioDocent', 'observacioAula', 'coordinacioExtern', 'tutoriaIndividual', 'provaInstrument'];
  const records = [];
  students.forEach((s, i) => {
    const count = 2 + (i % 4);
    for (let k = 0; k < count; k += 1) {
      const day = dayIn(0.1 + ((k * 7 + i * 3) % 85) / 100);
      const type = pick(recordTypes, i + k);
      records.push(newRecord({
        studentIds: [s.id],
        at: `${day}T${String(9 + (k % 6)).padStart(2, '0')}:30`,
        type,
        author: 'Orientació educativa',
        participants: type === 'entrevistaFamilia' ? [`Mare de ${s.name}`, s.tutorName] : [s.tutorName],
        serviceId: type === 'coordinacioExtern' ? pick(services, i).id : '',
        content: `Actuació de seguiment amb ${s.name}. Es recullen les observacions del tutor/a i s’acorden les mesures a aplicar a l’aula.`,
        agreements: k === 0 ? [newAgreement({
          text: 'Revisar l’aplicació de les mesures a l’aula',
          owner: s.tutorName,
          due: toISODate(addDays(base, (i % 5) * 7 - 10)),
          state: i % 3 === 0 ? 'fet' : 'pendent',
        })] : [],
      }));
    }
  });

  const appointments = [];
  students.forEach((s, i) => {
    for (let k = -2; k <= 2; k += 1) {
      const day = toISODate(addDays(base, k * 3 + (i % 4)));
      const start = `${day}T${String(9 + (i % 5)).padStart(2, '0')}:00`;
      appointments.push(newAppointment({
        studentIds: [s.id],
        start,
        end: addMinutes(start, 45),
        type: pick(['entrevistaFamilia', 'coordinacioDocent', 'coordinacioExtern', 'observacioAula'], i + k),
        attendees: [s.tutorName],
        modality: k % 3 === 0 ? 'telefonica' : 'presencial',
        location: 'Despatx d’orientació',
        state: k < 0 ? (i % 6 === 0 ? 'noPresentada' : 'feta') : 'programada',
      }));
    }
  });

  const demands = students.filter((_, i) => i % 3 === 0).map((s, i) => newDemand({
    studentId: s.id,
    origin: pick(['tutor', 'familia', 'equipDirectiu', 'serveiExtern'], i),
    receivedAt: dayIn(0.05 + i * 0.1),
    motive: 'Dificultats en la lectoescriptura i baixa autonomia en el treball autònom.',
    urgency: pick(['baixa', 'mitjana', 'alta'], i),
    assignedTo: 'Orientació educativa',
    firstActionAt: i % 2 === 0 ? dayIn(0.12 + i * 0.1) : '',
    state: i % 2 === 0 ? 'enCurs' : 'rebuda',
  }));

  const consents = students.filter((_, i) => i % 4 === 0).map((s, i) => newConsent({
    studentId: s.id,
    type: 'avaluacio',
    obtainedAt: dayIn(0.2 + i * 0.15),
    via: 'signatura',
    scope: 'Avaluació psicopedagògica i comunicació amb l’EAP.',
    document: `CONS/${year}/${10 + i}`,
  }));

  const referrals = students.filter((_, i) => i % 5 === 0).map((s, i) => newReferral({
    studentId: s.id,
    serviceId: pick(services, i).id,
    serviceName: pick(services, i).name,
    motive: 'Valoració complementària del cas.',
    requestedAt: dayIn(0.3 + i * 0.2),
    state: i % 2 === 0 ? 'enEspera' : 'resolta',
    resolvedAt: i % 2 === 0 ? '' : dayIn(0.6 + i * 0.1),
    consentId: consents[i]?.id || '',
  }));

  store.mutate((draft) => {
    draft.staff.push(...staff);
    draft.services.push(...services);
    draft.students.push(...students);
    draft.guardians.push(...guardians);
    draft.serviceLinks.push(...serviceLinks);
    draft.records.push(...records);
    draft.appointments.push(...appointments);
    draft.demands.push(...demands);
    draft.consents.push(...consents);
    draft.referrals.push(...referrals);

    records.forEach((record) => {
      (record.agreements || []).forEach((agreement) => {
        draft.tasks.push({
          id: `tk_${agreement.id}`,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          title: agreement.text,
          studentId: record.studentIds[0],
          owner: agreement.owner,
          due: agreement.due,
          state: agreement.state,
          doneAt: agreement.state === 'fet' ? agreement.due : '',
          origin: { kind: 'acord', refId: agreement.id, recordId: record.id },
          notes: '',
          annulled: null,
        });
      });
    });

    if (!draft.settings.centre.name) {
      draft.settings.centre.name = 'Centre d’exemple';
      draft.settings.centre.code = '08000000';
      draft.settings.centre.professional = 'Orientació educativa';
    }
  });
}
