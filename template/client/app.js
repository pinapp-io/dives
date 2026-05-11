/**
 * Boot orchestrator — wires all modules together.
 */
import { state } from './state.js';
import { ADDRESS, apiCall, generateId } from './utils.js';
import { initDB, dbSave, refreshObservations } from './store.js';
import { loadSpeciesCache } from './species-photos.js';
import { loadSitePackages } from './site-packages.js';
import { renderHome } from './home.js';
import { initCapturePage } from './capture.js';
import { initMapPage } from './map.js';
import { initHistoryPage } from './history.js';
import { initImportPage } from './import.js';

export async function boot(h3) {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById('tab-' + tabId).classList.add('active');
      window.dispatchEvent(new CustomEvent('tab-change', { detail: { tab: tabId } }));
    });
  });

  // Online/offline indicator
  function updateOnlineStatus() {
    const dot = document.getElementById('sync-indicator');
    dot.className = 'sync-dot ' + (navigator.onLine ? 'online' : 'offline');
    dot.title = navigator.onLine ? 'Online' : 'Offline';
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  try {
    await initDB();
    await refreshObservations();
    await loadSitePackages();
    loadSpeciesCache();

    state.instance = await apiCall(`/instance/${ADDRESS}`);
    state.templateManifest = await apiCall(`/templates/${state.instance.templateId}/manifest`);

    const f = state.instance.fixedAttributes || {};
    document.getElementById('site-title').textContent = f.name || 'Dive Site';

    // Seed IndexedDB from instance events on first load
    if (state.instance.events?.length && state.observations.length === 0) {
      for (const ev of state.instance.events) {
        const obs = { ...ev, id: ev.id || generateId(), timestamp: ev.timestamp ? new Date(ev.timestamp).getTime() : Date.now(), syncStatus: 'uploaded' };
        await dbSave(obs);
      }
      await refreshObservations();
    }

    updateOnlineStatus();
    renderHome();
    initCapturePage(h3);
    initMapPage(h3);
    initHistoryPage();
    initImportPage(h3);
  } catch (err) {
    document.getElementById('site-title').textContent = 'Error';
    document.getElementById('tab-home').innerHTML = `<div class="card" style="text-align:center;margin-top:40px;">
      <h2 style="color:var(--danger);">Failed to Load</h2>
      <p class="text-dim mt-2">${err.message}</p>
      <button class="btn btn-primary mt-4" onclick="location.reload()">Retry</button></div>`;
  }
}
