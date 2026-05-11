/**
 * IndexedDB store + sync to pinapp event API.
 */
import { state } from './state.js';
import { ADDRESS, API, apiCall, generateId } from './utils.js';

export function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('pinapp-dive-' + ADDRESS, 1);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('observations')) {
        const store = d.createObjectStore('observations', { keyPath: 'id' });
        store.createIndex('h3Index', 'h3Index', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('syncStatus', 'syncStatus', { unique: false });
      }
    };
    req.onsuccess = e => { state.db = e.target.result; resolve(); };
    req.onerror = e => reject(e.target.error);
  });
}

export function dbSave(obs) {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction('observations', 'readwrite');
    tx.objectStore('observations').put(obs);
    tx.oncomplete = () => resolve();
    tx.onerror = e => reject(e.target.error);
  });
}

export function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx = state.db.transaction('observations', 'readonly');
    const req = tx.objectStore('observations').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = e => reject(e.target.error);
  });
}

export async function refreshObservations() {
  state.observations = await dbGetAll();
  state.observations.sort((a, b) => b.timestamp - a.timestamp);
}

export async function syncToPinapp(obs) {
  try {
    const attrs = { ...obs };
    delete attrs.photoBlob;
    await apiCall(`/instance/${ADDRESS}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes: attrs })
    });
    obs.syncStatus = 'uploaded';
    await dbSave(obs);
  } catch (err) {
    console.warn('[Sync] Failed:', err.message);
  }
}
