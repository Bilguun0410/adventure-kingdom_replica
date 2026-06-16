/**
 * Thin wrapper around the Express/MongoDB backend.
 */

const API_BASE = 'http://localhost:3001/api';

export async function apiGet(path) {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPost(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiPut(path, body) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/**
 * Persist terrain tiles, buildings and fog in one call.
 */
export async function saveMapPayload(saveId, { tiles, buildings, fog }) {
  return apiPost('/save-map', { saveId, tiles, buildings, fog });
}
