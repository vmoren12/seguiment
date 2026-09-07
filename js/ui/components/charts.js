/**
 * charts.js - gràfics SVG construïts per codi, sense llibreries externes.
 * Estètica sòbria i monocroma amb l'accent. Cada gràfic s'acompanya d'una
 * taula equivalent per a lectors de pantalla i per a la impressió.
 */
import { html, raw } from '../dom.js';
import { t, fmtNum } from '../../core/i18n.js';

/** Embolcall amb títol, gràfic i taula alternativa desplegable. */
export function chartBox(title, chart, table) {
  return html`<figure class="chartbox" style="margin:0">
    ${title ? html`<figcaption class="field__label" style="margin-bottom:8px">${title}</figcaption>` : ''}
    ${chart}
    ${table ? html`<details>
      <summary>${t('a11y.chartTable')}</summary>
      ${table}
    </details>` : ''}
  </figure>`;
}

/** Taula equivalent d'un conjunt de parells etiqueta/valor. */
export function dataTable(items, labelHead = t('common.label'), valueHead = t('common.value')) {
  return html`<div class="tablewrap"><table class="table">
    <thead><tr><th>${labelHead}</th><th class="num">${valueHead}</th></tr></thead>
    <tbody>${items.map((i) => html`<tr><td>${i.label}</td><td class="num">${fmtNum(i.value)}</td></tr>`)}</tbody>
  </table></div>`;
}

/**
 * Barres horitzontals en HTML: òptimes per a distribucions categòriques
 * i totalment llegibles en pantalles petites.
 */
export function barList(items, { max, unit = '' } = {}) {
  if (!items.length) return html`<p class="muted small">${t('stats.noData')}</p>`;
  const top = max || Math.max(...items.map((i) => i.value), 1);
  return html`<div class="bars">
    ${items.map((i) => html`<div class="bars__row">
      <span class="truncate" title="${i.label}">${i.label}</span>
      <span class="bars__track"><span class="bars__fill" style="width:${Math.round((i.value / top) * 100)}%"></span></span>
      <span class="bars__n">${fmtNum(i.value)}${unit}</span>
    </div>`)}
  </div>`;
}

/**
 * Gràfic de columnes per a sèries temporals.
 * @param {Array<{label:string, value:number}>} points
 */
export function columnChart(points, { height = 150, title = '' } = {}) {
  if (!points.length) return html`<p class="muted small">${t('stats.noData')}</p>`;

  const width = Math.max(280, points.length * 46);
  const pad = { top: 16, right: 8, bottom: 24, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = innerW / points.length;
  const barW = Math.min(28, step * 0.62);

  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  return html`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title || t('common.evolution')}" preserveAspectRatio="xMidYMid meet">
    ${ticks.map((v) => {
    const y = pad.top + innerH - (v / max) * innerH;
    return html`<g>
        <line class="chart__grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/>
        <text x="${pad.left - 5}" y="${y + 3}" text-anchor="end">${v}</text>
      </g>`;
  })}
    ${points.map((p, index) => {
    const h = (p.value / max) * innerH;
    const x = pad.left + index * step + (step - barW) / 2;
    const y = pad.top + innerH - h;
    return html`<g>
        <rect class="chart__bar" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, p.value > 0 ? 2 : 0)}" rx="2"><title>${p.label}: ${p.value}</title></rect>
        ${p.value > 0 ? html`<text class="chart__val" x="${x + barW / 2}" y="${y - 4}" text-anchor="middle">${p.value}</text>` : ''}
        <text x="${x + barW / 2}" y="${height - 8}" text-anchor="middle">${p.label}</text>
      </g>`;
  })}
    <line class="chart__axis" x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}"/>
  </svg>`;
}

/**
 * Gràfic de línia amb àrea per a evolucions llargues.
 */
export function lineChart(points, { height = 150, title = '' } = {}) {
  if (points.length < 2) return columnChart(points, { height, title });

  const width = Math.max(300, points.length * 40);
  const pad = { top: 16, right: 10, bottom: 24, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = innerW / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: pad.left + i * step,
    y: pad.top + innerH - (p.value / max) * innerH,
    p,
  }));
  const line = coords.map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)},${pad.top + innerH} L${coords[0].x.toFixed(1)},${pad.top + innerH} Z`;
  const labelEvery = Math.ceil(points.length / 8);

  return html`<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title || t('common.evolution')}" preserveAspectRatio="xMidYMid meet">
    ${[0, max].map((v) => {
    const y = pad.top + innerH - (v / max) * innerH;
    return html`<g>
        <line class="chart__grid" x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}"/>
        <text x="${pad.left - 5}" y="${y + 3}" text-anchor="end">${v}</text>
      </g>`;
  })}
    <path class="chart__area" d="${raw(area)}"/>
    <path class="chart__line" d="${raw(line)}"/>
    ${coords.map((c, i) => html`<g>
      <circle class="chart__dot" cx="${c.x}" cy="${c.y}" r="3"><title>${c.p.label}: ${c.p.value}</title></circle>
      ${i % labelEvery === 0 ? html`<text x="${c.x}" y="${height - 8}" text-anchor="middle">${c.p.label}</text>` : ''}
    </g>`)}
    <line class="chart__axis" x1="${pad.left}" y1="${pad.top + innerH}" x2="${width - pad.right}" y2="${pad.top + innerH}"/>
  </svg>`;
}

/**
 * Barra apilada d'una sola fila: útil per a repartiments simples
 * (cites fetes / no presentades / anul·lades).
 */
export function stackedBar(segments, { height = 18 } = {}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  if (!total) return html`<p class="muted small">${t('stats.noData')}</p>`;
  let x = 0;
  return html`<svg class="chart" viewBox="0 0 100 ${height}" preserveAspectRatio="none" role="img" aria-label="${segments.map((s) => `${s.label}: ${s.value}`).join(', ')}" style="height:${height}px">
    ${segments.map((s) => {
    const w = (s.value / total) * 100;
    const rect = html`<rect x="${x}" y="0" width="${w}" height="${height}" fill="${s.color || 'var(--accent)'}" opacity="${s.opacity ?? 1}"><title>${s.label}: ${s.value}</title></rect>`;
    x += w;
    return rect;
  })}
  </svg>`;
}

/** Indicador circular compacte per a percentatges. */
export function gauge(value, { size = 64, label = '' } = {}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, value)) / 100);
  return html`<svg class="chart" viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px" role="img" aria-label="${label}: ${value} %">
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--surface-3)" stroke-width="6"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--accent)" stroke-width="6"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dy="4" style="font-size:13px;font-weight:600;fill:var(--text)">${Math.round(value)}%</text>
  </svg>`;
}
