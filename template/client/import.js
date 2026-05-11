/**
 * Import tab — UDDF, CSV, Subsurface .ssrf parsers.
 */
import { state } from './state.js';
import { generateId } from './utils.js';
import { dbSave, refreshObservations, syncToPinapp } from './store.js';
import { renderHome } from './home.js';

let h3Module = null;

export function initImportPage(h3) {
  h3Module = h3;
  const container = document.getElementById('tab-import');
  container.innerHTML = `
    <div class="card"><h3 style="color:var(--ocean-glow);font-size:16px;">\u{1F4E5} Import Dive Data</h3><p class="text-dim text-sm mt-2">Import dive logs from your dive computer or other apps.</p></div>
    <div class="card mt-2"><h4 class="text-sm" style="color:var(--ocean-glow);">UDDF Files</h4><p class="text-dim text-sm">Universal Dive Data Format \u2014 from Subsurface, MacDive, or dive computers.</p>
      <input type="file" id="uddf-input" accept=".uddf,.xml" style="display:none;"><button class="btn btn-primary btn-full mt-2" id="btn-uddf">Import UDDF</button></div>
    <div class="card mt-2"><h4 class="text-sm" style="color:var(--ocean-glow);">CSV Depth Profiles</h4><p class="text-dim text-sm">From Paralenz, Garmin, or spreadsheets.</p>
      <input type="file" id="csv-input" accept=".csv,.txt" style="display:none;"><button class="btn btn-primary btn-full mt-2" id="btn-csv">Import CSV</button></div>
    <div class="card mt-2"><h4 class="text-sm" style="color:var(--ocean-glow);">Subsurface Logbook</h4><p class="text-dim text-sm">.ssrf files from Subsurface application.</p>
      <input type="file" id="ssrf-input" accept=".ssrf,.xml" style="display:none;"><button class="btn btn-primary btn-full mt-2" id="btn-ssrf">Import Subsurface</button></div>
    <div id="import-results" class="hidden mt-2"></div>`;

  container.querySelector('#btn-uddf').addEventListener('click', () => container.querySelector('#uddf-input').click());
  container.querySelector('#uddf-input').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await importUddf(f); });
  container.querySelector('#btn-csv').addEventListener('click', () => container.querySelector('#csv-input').click());
  container.querySelector('#csv-input').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await importCsv(f); });
  container.querySelector('#btn-ssrf').addEventListener('click', () => container.querySelector('#ssrf-input').click());
  container.querySelector('#ssrf-input').addEventListener('change', async e => { const f = e.target.files?.[0]; if (f) await importSubsurface(f); });
}

async function importUddf(file) {
  showImportStatus('Parsing UDDF...');
  try {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    const siteMap = new Map();
    doc.querySelectorAll('divesite site, site').forEach(site => {
      const id = site.getAttribute('id') || '';
      const name = site.querySelector('name')?.textContent || '';
      const geo = site.querySelector('geography');
      const lat = geo?.querySelector('latitude')?.textContent;
      const lng = geo?.querySelector('longitude')?.textContent;
      siteMap.set(id, { name, lat: lat ? parseFloat(lat) : undefined, lng: lng ? parseFloat(lng) : undefined });
    });
    const dives = [];
    doc.querySelectorAll('dive').forEach(diveEl => {
      const dateStr = diveEl.querySelector('datetime')?.textContent || diveEl.querySelector('date')?.textContent || '';
      const date = dateStr ? new Date(dateStr) : new Date();
      const maxDepth = parseFloat(diveEl.querySelector('greatestdepth, maximumdepth')?.textContent || '0');
      const duration = parseFloat(diveEl.querySelector('diveduration')?.textContent || '0');
      const tempEl = diveEl.querySelector('lowesttemperature, temperatureminimum');
      const minTemp = tempEl ? parseFloat(tempEl.textContent) - 273.15 : undefined;
      const siteRef = diveEl.querySelector('link[ref]')?.getAttribute('ref');
      const siteInfo = siteRef ? siteMap.get(siteRef) : null;
      const profile = [];
      diveEl.querySelectorAll('waypoint').forEach(wp => {
        const time = parseFloat(wp.querySelector('divetime')?.textContent || '0');
        const depth = parseFloat(wp.querySelector('depth')?.textContent || '0');
        const temp = wp.querySelector('temperature') ? parseFloat(wp.querySelector('temperature').textContent) - 273.15 : undefined;
        profile.push({ time, depth, temp });
      });
      dives.push({ date, duration, maxDepth, minTemp, gpsLat: siteInfo?.lat, gpsLng: siteInfo?.lng, siteName: siteInfo?.name, profile: profile.length ? profile : undefined });
    });
    await saveDivesAsObs(dives, 'UDDF');
  } catch (err) { showImportStatus(`Error: ${err.message}`, true); }
}

async function importCsv(file) {
  showImportStatus('Parsing CSV...');
  try {
    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) { showImportStatus('Empty CSV', true); return; }
    const header = lines[0].toLowerCase().split(/[,;\t]/);
    const depthCol = header.findIndex(h => /depth/i.test(h));
    const tempCol = header.findIndex(h => /temp/i.test(h));
    const timeCol = header.findIndex(h => /time|seconds|elapsed/i.test(h));
    const latCol = header.findIndex(h => /lat/i.test(h));
    const lngCol = header.findIndex(h => /lon|lng/i.test(h));
    if (depthCol === -1) { showImportStatus('No depth column found', true); return; }
    const profile = [];
    let gpsLat, gpsLng;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,;\t]/);
      const depth = parseFloat(cols[depthCol]); if (isNaN(depth)) continue;
      const time = timeCol >= 0 ? parseFloat(cols[timeCol]) : (i - 1) * 20;
      const temp = tempCol >= 0 ? parseFloat(cols[tempCol]) : undefined;
      if (i === 1) { if (latCol >= 0) gpsLat = parseFloat(cols[latCol]); if (lngCol >= 0) gpsLng = parseFloat(cols[lngCol]); }
      profile.push({ time, depth, temp: isNaN(temp) ? undefined : temp });
    }
    const maxDepth = Math.max(...profile.map(p => p.depth));
    const duration = profile.length ? profile[profile.length - 1].time : 0;
    await saveDivesAsObs([{ date: new Date(), duration, maxDepth, gpsLat, gpsLng, siteName: file.name.replace(/\.\w+$/, ''), profile }], 'CSV');
  } catch (err) { showImportStatus(`Error: ${err.message}`, true); }
}

async function importSubsurface(file) {
  showImportStatus('Parsing Subsurface...');
  try {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    const dives = [];
    doc.querySelectorAll('dive').forEach(diveEl => {
      const dateStr = diveEl.getAttribute('date') || '';
      const timeStr = diveEl.getAttribute('time') || '00:00:00';
      const date = new Date(`${dateStr}T${timeStr}`);
      const durStr = diveEl.getAttribute('duration') || '0:00';
      const durM = durStr.match(/(\d+):(\d+)/);
      const duration = durM ? parseInt(durM[1]) * 60 + parseInt(durM[2]) : 0;
      const profile = [];
      let maxDepth = 0;
      diveEl.querySelectorAll('sample').forEach(s => {
        const tStr = s.getAttribute('time') || '0:00';
        const tM = tStr.match(/(\d+):(\d+)/);
        const time = tM ? parseInt(tM[1]) * 60 + parseInt(tM[2]) : 0;
        const depth = parseFloat(s.getAttribute('depth') || '0'); if (depth > maxDepth) maxDepth = depth;
        const temp = s.getAttribute('temp') ? parseFloat(s.getAttribute('temp')) : undefined;
        profile.push({ time, depth, temp });
      });
      const loc = diveEl.querySelector('location');
      const gpsStr = loc?.getAttribute('gps');
      let gpsLat, gpsLng;
      if (gpsStr) { const parts = gpsStr.split(/\s+/); if (parts.length === 2) { gpsLat = parseFloat(parts[0]); gpsLng = parseFloat(parts[1]); } }
      dives.push({ date, duration, maxDepth, gpsLat, gpsLng, siteName: loc?.textContent || undefined, profile: profile.length ? profile : undefined });
    });
    await saveDivesAsObs(dives, 'Subsurface');
  } catch (err) { showImportStatus(`Error: ${err.message}`, true); }
}

async function saveDivesAsObs(dives, source) {
  if (!dives.length) { showImportStatus('No dives found.', true); return; }
  let saved = 0, skipped = 0;
  for (const dive of dives) {
    const lat = dive.gpsLat, lng = dive.gpsLng;
    if (!lat || !lng) { skipped++; continue; }
    const id = generateId();
    let h3Index = '';
    try { h3Index = h3Module.latLngToCell(lat, lng, 10); } catch {}
    const notes = [`Imported from ${source}`, dive.siteName ? `Site: ${dive.siteName}` : '', `Max depth: ${dive.maxDepth.toFixed(1)}m`, `Duration: ${Math.floor(dive.duration / 60)}min`].filter(Boolean).join('\n');
    const obs = { id, timestamp: dive.date.getTime(), type: 'general', gpsLat: lat, gpsLng: lng, h3Index, depth: dive.maxDepth, temperature: dive.minTemp, notes, depthProfile: dive.profile, syncStatus: 'local' };
    await dbSave(obs);
    syncToPinapp(obs);
    saved++;
  }
  await refreshObservations();
  showImportStatus(`Imported ${saved} dives from ${source}.${skipped ? ' ' + skipped + ' skipped (no GPS).' : ''}`);
  renderHome();
}

function showImportStatus(msg, isError = false) {
  const el = document.getElementById('import-results');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="card" style="border-color:${isError ? 'var(--danger)' : 'var(--reef-green)'};">
    <p style="color:${isError ? 'var(--danger)' : 'var(--reef-green)'};">${msg}</p></div>`;
}
