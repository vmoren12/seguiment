/**
 * labels.js - conversió de valors interns en text llegible.
 * Viu a la capa d'interfície perquè el domini no depengui de l'idioma.
 */
import { t, tEnum } from '../core/i18n.js';

/** Text llegible del document associat a una baula de la cadena documental. */
export function chainDoc(step) {
  if (!step || !step.doc) return '';
  if (step.key === 'seguiment') return t('chain.actionsCount', { n: step.doc });
  if (step.key === 'decisio') return t('chain.measuresCount', { n: step.doc });
  return step.docEnum ? tEnum(step.docEnum, step.doc) : step.doc;
}

/** Text llegible del responsable o la via d'una baula de la cadena documental. */
export function chainWho(step) {
  if (!step || !step.who) return '';
  return step.whoEnum ? tEnum(step.whoEnum, step.who) : step.who;
}

/** Etiqueta d'un element de la cronologia del cas. */
export function timelineTitle(item) {
  switch (item.kind) {
    case 'record': return tEnum('recordType', item.title);
    case 'appointment': return `${t('agenda.title')}: ${tEnum('appointmentType', item.title)}`;
    case 'consent': return `${t('casework.consents')}: ${tEnum('consentType', item.title)}`;
    case 'demand': return `${t('casework.demands')}: ${item.title}`;
    case 'referral': return `${t('casework.referrals')}: ${item.title}`;
    default: return item.title;
  }
}
