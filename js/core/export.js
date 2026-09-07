/**
 * export.js - generació de fitxers: JSON, CSV i ICS.
 * Cap dependència externa; tot es construeix amb text pla.
 */
import { download, slug } from './util.js';
import { toISODate, today } from './dates.js';

/* ------------------------------- JSON ---------------------------------- */

/** Descarrega un objecte com a JSON amb sagnat llegible. */
export function exportJSON(data, name) {
  const filename = `${slug(name || 'seguiment')}-${today()}.json`;
  download(filename, JSON.stringify(data, null, 2), 'application/json');
  return filename;
}

/* -------------------------------- CSV ---------------------------------- */

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value).replace(/\r?\n/g, ' ');
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Construeix un CSV amb separador de punt i coma (compatible amb Excel en
 * configuració catalana i castellana) i BOM per preservar els accents.
 */
export function toCSV(headers, rows) {
  const head = headers.map(csvCell).join(';');
  const body = rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
  return `﻿${head}\r\n${body}`;
}

/** Descarrega una taula com a CSV. */
export function exportCSV(headers, rows, name) {
  const filename = `${slug(name || 'taula')}-${today()}.csv`;
  download(filename, toCSV(headers, rows), 'text/csv');
  return filename;
}

/* -------------------------------- ICS ---------------------------------- */

function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsStamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

function icsUtcStamp(date = new Date()) {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
}

/** Plega les línies a 75 octets segons RFC 5545. */
function fold(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) { parts.push(` ${rest.slice(0, 74)}`); rest = rest.slice(74); }
  return parts.join('\r\n');
}

/**
 * Construeix un calendari ICS a partir d'una llista d'esdeveniments
 * { uid, start, end, title, description, location, status }.
 */
export function toICS(events, calendarName = 'Seguiment') {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Seguiment//Orientacio educativa//CA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
  ];

  events.forEach((event) => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}@seguiment.local`);
    lines.push(`DTSTAMP:${icsUtcStamp()}`);
    lines.push(`DTSTART:${icsStamp(event.start)}`);
    lines.push(`DTEND:${icsStamp(event.end)}`);
    lines.push(fold(`SUMMARY:${icsEscape(event.title)}`));
    if (event.description) lines.push(fold(`DESCRIPTION:${icsEscape(event.description)}`));
    if (event.location) lines.push(fold(`LOCATION:${icsEscape(event.location)}`));
    if (event.status) lines.push(`STATUS:${event.status}`);
    if (event.alarmMinutes) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${event.alarmMinutes}M`,
        `DESCRIPTION:${icsEscape(event.title)}`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Descarrega un fitxer ICS. */
export function exportICS(events, name = 'agenda') {
  const filename = `${slug(name)}-${toISODate(new Date())}.ics`;
  download(filename, toICS(events, name), 'text/calendar');
  return filename;
}
