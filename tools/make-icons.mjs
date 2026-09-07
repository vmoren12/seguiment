/**
 * make-icons.mjs — genera les icones PNG de la PWA a partir de la mateixa
 * definició geomètrica que assets/icon.svg, sense cap dependència externa.
 *
 *   node tools/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

const BG = [0x2f, 0x5d, 0x50];
const FG = [0xf2, 0xf5, 0xf3];

/* ------------------------------- Rasterització --------------------------- */

function canvas(size, background) {
  const px = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i += 1) {
    px[i * 4] = background[0];
    px[i * 4 + 1] = background[1];
    px[i * 4 + 2] = background[2];
    px[i * 4 + 3] = 255;
  }
  return px;
}

/** Barreja un color sobre un píxel amb una cobertura de 0 a 1. */
function blend(px, size, x, y, color, alpha) {
  if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
  const i = (y * size + x) * 4;
  const a = Math.min(1, alpha);
  px[i] = Math.round(px[i] * (1 - a) + color[0] * a);
  px[i + 1] = Math.round(px[i + 1] * (1 - a) + color[1] * a);
  px[i + 2] = Math.round(px[i + 2] * (1 - a) + color[2] * a);
}

/** Traça un segment de gruix constant amb extrems arrodonits. */
function line(px, size, x1, y1, x2, y2, width, color) {
  const half = width / 2;
  const minX = Math.floor(Math.min(x1, x2) - half - 1);
  const maxX = Math.ceil(Math.max(x1, x2) + half + 1);
  const minY = Math.floor(Math.min(y1, y2) - half - 1);
  const maxY = Math.ceil(Math.max(y1, y2) + half + 1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let tt = ((cx - x1) * dx + (cy - y1) * dy) / len2;
      tt = Math.max(0, Math.min(1, tt));
      const px2 = x1 + tt * dx;
      const py2 = y1 + tt * dy;
      const dist = Math.hypot(cx - px2, cy - py2);
      blend(px, size, x, y, color, half + 0.5 - dist);
    }
  }
}

/** Traça una circumferència de gruix constant. */
function ring(px, size, cx, cy, radius, width, color) {
  const half = width / 2;
  const min = Math.floor(cx - radius - half - 1);
  const max = Math.ceil(cx + radius + half + 1);
  for (let y = Math.floor(cy - radius - half - 1); y <= Math.ceil(cy + radius + half + 1); y += 1) {
    for (let x = min; x <= max; x += 1) {
      const dist = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - radius);
      blend(px, size, x, y, color, half + 0.5 - dist);
    }
  }
}

/** Arrodoneix les cantonades fent transparent l'exterior del radi. */
function roundCorners(px, size, radius) {
  const corners = [[radius, radius], [size - radius, radius], [radius, size - radius], [size - radius, size - radius]];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inX = x >= radius && x <= size - radius;
      const inY = y >= radius && y <= size - radius;
      if (inX || inY) continue;
      const corner = corners.find(([ccx, ccy]) => (x < ccx || x > ccx) && (y < ccy || y > ccy)
        && Math.abs(x - ccx) <= radius && Math.abs(y - ccy) <= radius);
      const c = corner || corners.reduce((best, cur) => {
        const d = Math.hypot(x + 0.5 - cur[0], y + 0.5 - cur[1]);
        return d < best.d ? { d, cur } : best;
      }, { d: Infinity, cur: corners[0] }).cur;
      const dist = Math.hypot(x + 0.5 - c[0], y + 0.5 - c[1]);
      const alpha = Math.max(0, Math.min(1, radius + 0.5 - dist));
      px[(y * size + x) * 4 + 3] = Math.round(255 * alpha);
    }
  }
}

/** Dibuixa la marca sobre un llenç quadrat. */
function drawMark(size, { rounded = true, padding = 0 } = {}) {
  const px = canvas(size, BG);
  const unit = (size - padding * 2) / 64;
  const at = (v) => padding + v * unit;
  const stroke = 3.2 * unit;

  line(px, size, at(20), at(18), at(20), at(46), stroke, FG);
  line(px, size, at(20), at(22), at(42), at(22), stroke, FG);
  line(px, size, at(20), at(32), at(36), at(32), stroke, FG);
  line(px, size, at(20), at(42), at(30), at(42), stroke, FG);
  ring(px, size, at(44), at(42), 6 * unit, stroke, FG);

  if (rounded) roundCorners(px, size, Math.round(size * 0.22));
  return px;
}

/* --------------------------------- PNG ---------------------------------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePNG(pixels, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // filtre «none»
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // profunditat de bits
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------- Sortida -------------------------------- */

mkdirSync(OUT, { recursive: true });

const targets = [
  { name: 'icon-192.png', size: 192, options: { rounded: true } },
  { name: 'icon-512.png', size: 512, options: { rounded: true } },
  // La versió «maskable» necessita marge de seguretat i cap cantonada retallada.
  { name: 'icon-maskable.png', size: 512, options: { rounded: false, padding: 512 * 0.12 } },
];

targets.forEach(({ name, size, options }) => {
  const png = encodePNG(drawMark(size, options), size);
  writeFileSync(join(OUT, name), png);
  console.log(`${name} — ${size}×${size} — ${(png.length / 1024).toFixed(1)} kB`);
});
