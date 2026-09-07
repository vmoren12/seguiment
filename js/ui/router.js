/**
 * router.js - encaminament per fragment d'URL (#/vista/param?clau=valor).
 * Permet enllaçar i compartir estats concrets de l'aplicació i mantenir
 * l'històric del navegador.
 */

const listeners = new Set();
let route = parse(location.hash);

function parse(hash) {
  const clean = String(hash || '').replace(/^#\/?/, '');
  const [pathPart, queryPart] = clean.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = {};
  new URLSearchParams(queryPart || '').forEach((value, key) => { query[key] = value; });
  return {
    name: segments[0] || 'inici',
    id: segments[1] || '',
    segments,
    query,
  };
}

/** Ruta actual. */
export function current() { return route; }

/** Construeix una adreça a partir de segments i paràmetres. */
export function href(name, id = '', query = {}) {
  const path = [name, id].filter(Boolean).map(encodeURIComponent).join('/');
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString();
  return `#/${path}${qs ? `?${qs}` : ''}`;
}

/** Navega a una ruta. */
export function navigate(name, id = '', query = {}, { replace = false } = {}) {
  const target = href(name, id, query);
  if (replace) location.replace(target);
  else location.hash = target;
}

/** Actualitza només els paràmetres de la ruta actual sense afegir històric. */
export function setQuery(patch, { replace = true } = {}) {
  const query = { ...route.query, ...patch };
  Object.keys(query).forEach((k) => { if (query[k] === '' || query[k] === undefined || query[k] === null) delete query[k]; });
  navigate(route.name, route.id, query, { replace });
}

/** Subscripció als canvis de ruta. */
export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function handleChange() {
  route = parse(location.hash);
  listeners.forEach((fn) => fn(route));
}

/** Engega l'escolta de canvis d'adreça. */
export function startRouter() {
  window.addEventListener('hashchange', handleChange);
  if (!location.hash) location.replace('#/inici');
  route = parse(location.hash);
}
