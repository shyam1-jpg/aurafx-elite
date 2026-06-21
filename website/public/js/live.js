/** Shared live API — same origin when website server is running */
const API = '';

export async function fetchLive(path) {
  const res = await fetch(API + path, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('API ' + res.status);
  return res.json();
}

export function getSessionGMT() {
  const h = new Date().getUTCHours();
  if (h >= 12 && h < 16) return { name: 'London / NY Overlap', best: true };
  if (h >= 7 && h < 16) return { name: 'London', best: true };
  if (h >= 12 && h < 21) return { name: 'New York', best: true };
  if (h >= 0 && h < 9) return { name: 'Asian', best: false };
  return { name: 'Off-hours', best: false };
}
