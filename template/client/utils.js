/**
 * Shared utilities — constants and helpers used across modules.
 */

export const ADDRESS = window.location.pathname.split('/').filter(Boolean).pop();
// Mount path = the agent's URL prefix (e.g. /agent/epistery/dive). The instance
// page lives at `${MOUNT}/${ADDRESS}`; strip the trailing segment to find it.
export const MOUNT = window.location.pathname.replace(/\/[^/]*\/?$/, '');
export const API = `${MOUNT}/api`;
export const TEMPLATE_BASE = `${MOUNT}/assets`;
export const INATURALIST_API = 'https://api.inaturalist.org/v1/taxa';

export async function apiCall(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

export function fmtTime(ts) {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
  return d.toLocaleDateString();
}

export function generateId() {
  return 'obs-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function eventIcon(type) {
  const icons = { dive: '\u{1F93F}', coral: '\u{1FAB8}', species: '\u{1F420}', photo: '\u{1F4F7}', condition: '\u{1F30A}', note: '\u{1F4DD}', health: '\u{1FA7A}', temperature: '\u{1F321}', general: '\u{1F4DD}' };
  return icons[type] || '\u2022';
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const max = 1200;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/png').split(',')[1]);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
