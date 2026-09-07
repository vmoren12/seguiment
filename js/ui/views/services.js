/**
 * services.js - fitxes de serveis externs reutilitzables entre alumnes
 * i registre de professionals interns del centre.
 */
import { html, icon } from '../dom.js';
import { t, tEnum, fmtDate } from '../../core/i18n.js';
import * as sel from '../../domain/selectors.js';
import * as store from '../../core/store.js';
import * as act from '../../domain/actions.js';
import { href } from '../router.js';
import { exportCSV } from '../../core/export.js';
import { editService, editStaff, editServiceLink, annulEntity } from '../editors.js';
import { scheduleRender } from '../shell.js';

export function title({ state }) {
  return { title: t('services.title'), subtitle: `${store.live('services').length} ${t('common.services').toLowerCase()}` };
}

export function render({ state }) {
  const services = store.live('services');
  const staff = store.live('staff');
  const p = state.settings.presentation;

  return html`
    <div class="page-head">
      <div><h2>${t('services.title')}</h2></div>
      <div class="row">
        <button type="button" class="btn btn--sm" data-act="sv:csv">${icon('download')}CSV</button>
        <button type="button" class="btn btn--sm" data-act="sv:staff:new">${icon('plus')}${t('services.newInternal')}</button>
        <button type="button" class="btn btn--primary" data-act="sv:new">${icon('plus')}${t('services.new')}</button>
      </div>
    </div>

    <h4 style="margin-bottom:8px">${t('services.external')}</h4>
    ${services.length ? html`<div class="grid grid--2" style="margin-bottom:24px">
      ${services.map((s) => {
    const linked = sel.studentsOfService(state, s.id);
    return html`<section class="card">
        <div class="card__head">
          <h3>${s.name}</h3>
          <span class="chip chip--outline">${tEnum('serviceKind', s.kind)}</span>
          <button type="button" class="iconbtn iconbtn--sm" data-act="sv:edit" data-id="${s.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
          <button type="button" class="iconbtn iconbtn--sm" data-act="sv:del" data-id="${s.id}" aria-label="${t('common.delete')}">${icon('trash')}</button>
        </div>
        <dl class="deflist">
          ${s.contact ? html`<div><dt>${t('services.contact')}</dt><dd>${s.contact}</dd></div>` : ''}
          ${s.phone ? html`<div><dt>${t('common.phone')}</dt><dd><a href="tel:${s.phone}">${s.phone}</a></dd></div>` : ''}
          ${s.email ? html`<div><dt>${t('common.email')}</dt><dd><a href="mailto:${s.email}">${s.email}</a></dd></div>` : ''}
          ${s.frequency ? html`<div><dt>${t('services.frequency')}</dt><dd>${s.frequency}</dd></div>` : ''}
          ${s.startedAt || s.endedAt ? html`<div><dt>${t('common.period')}</dt><dd>${[s.startedAt ? fmtDate(s.startedAt) : '', s.endedAt ? fmtDate(s.endedAt) : ''].filter(Boolean).join(' – ')}</dd></div>` : ''}
        </dl>
        ${s.notes ? html`<p class="small muted pre-wrap" style="margin-top:8px">${s.notes}</p>` : ''}
        <div class="card__foot">
          <div class="row row--between">
            <span class="field__label">${t('services.linkedStudents')} · ${linked.length}</span>
            <button type="button" class="btn btn--sm" data-act="sv:link" data-id="${s.id}">${t('services.linkStudent')}</button>
          </div>
          ${linked.length ? html`<ul class="list" style="margin-top:8px">
            ${linked.map(({ link, student }) => html`<li class="listitem" style="padding:6px 0">
              <span class="listitem__main">
                <a class="listitem__title" href="${href('alumnat', student.id, { t: 'services' })}">${sel.listName(student, p)}</a>
                <span class="listitem__meta">
                  <span>${student.level} ${student.group}</span>
                  ${link.role ? html`<span>${link.role}</span>` : ''}
                  <span>${fmtDate(link.linkedAt)}</span>
                </span>
              </span>
              <button type="button" class="iconbtn iconbtn--sm" data-act="sv:unlink" data-id="${link.id}" aria-label="${t('common.remove')}">${icon('close')}</button>
            </li>`)}
          </ul>` : html`<p class="muted small" style="margin-top:8px">${t('common.empty')}</p>`}
        </div>
      </section>`;
  })}
    </div>` : html`<div class="empty" style="margin-bottom:24px"><h3>${t('services.empty')}</h3></div>`}

    <h4 style="margin-bottom:8px">${t('services.internal')}</h4>
    <section class="card card--pad0">
      ${staff.length ? html`<div class="tablewrap"><table class="table table--cards">
        <thead><tr><th>${t('common.name')}</th><th>${t('services.internalRole')}</th><th>${t('common.email')}</th><th>${t('common.phone')}</th><th></th></tr></thead>
        <tbody>${staff.map((x) => html`<tr>
          <td data-th="${t('common.name')}">${x.name}</td>
          <td data-th="${t('services.internalRole')}">${tEnum('staffRole', x.role)}</td>
          <td data-th="${t('common.email')}">${x.email || '—'}</td>
          <td data-th="${t('common.phone')}">${x.phone || '—'}</td>
          <td class="right">
            <button type="button" class="iconbtn iconbtn--sm" data-act="sv:staff:edit" data-id="${x.id}" aria-label="${t('common.edit')}">${icon('edit')}</button>
            <button type="button" class="iconbtn iconbtn--sm" data-act="sv:staff:del" data-id="${x.id}" aria-label="${t('common.delete')}">${icon('trash')}</button>
          </td>
        </tr>`)}</tbody>
      </table></div>` : html`<div class="empty"><h3>${t('common.empty')}</h3></div>`}
    </section>`;
}

export function actions({ state }) {
  const refresh = () => scheduleRender();
  return {
    'sv:new': () => editService({ onSaved: refresh }),
    'sv:edit': (el) => editService({ serviceId: el.dataset.id, onSaved: refresh }),
    'sv:del': (el) => annulEntity('services', el.dataset.id, { onDone: refresh }),
    'sv:link': (el) => editServiceLink({ serviceId: el.dataset.id, onSaved: refresh }),
    'sv:unlink': (el) => annulEntity('serviceLinks', el.dataset.id, { onDone: refresh }),
    'sv:staff:new': () => editStaff({ onSaved: refresh }),
    'sv:staff:edit': (el) => editStaff({ staffId: el.dataset.id, onSaved: refresh }),
    'sv:staff:del': (el) => annulEntity('staff', el.dataset.id, { onDone: refresh }),
    'sv:csv': () => {
      const rows = store.live('services').map((s) => [
        s.name, tEnum('serviceKind', s.kind), s.contact, s.phone, s.email, s.frequency,
        sel.studentsOfService(state, s.id).length,
      ]);
      exportCSV(['Servei', 'Tipus', 'Professional', 'Telèfon', 'Correu', 'Freqüència', 'Casos'], rows, 'serveis');
      act.logExport('CSV', `${rows.length} serveis`);
    },
  };
}
