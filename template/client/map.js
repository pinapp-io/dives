/**
 * Map tab — Leaflet + ESRI satellite + H3 hex overlay + photo markers.
 */
import { state } from './state.js';
import { API, fmtTime, eventIcon } from './utils.js';

let hexLayer = null, markerLayer = null;
let h3Module = null;

export function initMapPage(h3) {
  h3Module = h3;
  document.getElementById('tab-map').innerHTML = `<div id="map-container"></div><div id="hex-detail" class="card map-detail-panel hidden"></div>`;
  window.addEventListener('tab-change', e => {
    if (e.detail.tab === 'map') { if (!state.mapInitialized) initMap(); else refreshMap(); }
  });
}

function initMap() {
  state.mapInitialized = true;
  const defaultCenter = state.sitePackages[0] ? [state.sitePackages[0].centerLat, state.sitePackages[0].centerLng] : [19.36, -81.40];
  state.leafletMap = L.map('map-container', { center: defaultCenter, zoom: 15 });
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles \u00A9 Esri', maxZoom: 19 }).addTo(state.leafletMap);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(state.leafletMap);
  hexLayer = L.layerGroup().addTo(state.leafletMap);
  markerLayer = L.layerGroup().addTo(state.leafletMap);
  refreshMap();
}

function refreshMap() {
  if (!state.leafletMap || !hexLayer || !markerLayer) return;
  hexLayer.clearLayers(); markerLayer.clearLayers();
  const gpsObs = state.observations.filter(o => o.gpsLat && o.gpsLng);
  if (!gpsObs.length) return;

  // H3 hex overlay
  const hexMap = new Map();
  for (const obs of gpsObs) {
    if (!obs.h3Index) continue;
    const existing = hexMap.get(obs.h3Index) || [];
    existing.push(obs); hexMap.set(obs.h3Index, existing);
  }

  const allBounds = [];
  hexMap.forEach((hexObs, h3Index) => {
    try {
      const boundary = h3Module.cellToBoundary(h3Index);
      const latLngs = boundary.map(([lat, lng]) => L.latLng(lat, lng));
      allBounds.push(...latLngs);
      const count = hexObs.length;
      const color = count >= 10 ? '#22c55e' : count >= 5 ? '#fbbf24' : '#22d3ee';
      const polygon = L.polygon(latLngs, { color, weight: 2, fillColor: color, fillOpacity: Math.min(0.15 + count * 0.05, 0.5) });
      const species = [...new Set(hexObs.filter(o => o.species).map(o => o.species))];
      let tooltip = `<strong>${count} observation${count > 1 ? 's' : ''}</strong>`;
      if (species.length) tooltip += `<br>${species.slice(0, 3).join(', ')}${species.length > 3 ? '<br>+' + (species.length - 3) + ' more' : ''}`;
      polygon.bindTooltip(tooltip, { permanent: false });
      polygon.on('click', () => showHexDetail(h3Index, hexObs));
      hexLayer.addLayer(polygon);
    } catch {}
  });

  // Photo markers
  for (const obs of gpsObs) {
    if (obs.photoBlob || obs.photoId) {
      const src = obs.photoBlob ? URL.createObjectURL(obs.photoBlob) : `${API}/image/${obs.photoId}`;
      const icon = L.divIcon({
        className: '', iconSize: [36, 36], iconAnchor: [18, 18],
        html: `<div style="width:36px;height:36px;border-radius:8px;overflow:hidden;border:2px solid var(--ocean-glow);box-shadow:0 2px 8px rgba(0,0,0,0.5);"><img src="${src}" style="width:100%;height:100%;object-fit:cover;"></div>`
      });
      const marker = L.marker([obs.gpsLat, obs.gpsLng], { icon });
      marker.bindPopup(`<b>${obs.type}${obs.species ? ': ' + obs.species : ''}</b><br>${obs.notes?.slice(0, 60) || ''}<br><small>${fmtTime(obs.timestamp)}</small>`);
      markerLayer.addLayer(marker);
    }
  }

  if (allBounds.length > 0) state.leafletMap.fitBounds(L.latLngBounds(allBounds).pad(0.15));
  setTimeout(() => state.leafletMap.invalidateSize(), 100);
}

function showHexDetail(h3Index, hexObs) {
  const detail = document.getElementById('hex-detail');
  detail.classList.remove('hidden');
  const sorted = [...hexObs].sort((a, b) => b.timestamp - a.timestamp);
  const species = [...new Set(sorted.filter(o => o.species).map(o => o.species))];
  detail.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;margin-bottom:8px;border-bottom:1px solid var(--border);">
      <div><span class="text-glow" style="font-weight:700;">${sorted.length} observation${sorted.length > 1 ? 's' : ''}</span>
        <span class="text-dim text-sm" style="margin-left:8px;">Hex: ${h3Index.slice(0, 10)}...</span></div>
      <button id="close-hex" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer;">\u2715</button>
    </div>
    ${species.length ? `<div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:4px;">${species.map(s => `<span style="font-size:11px;padding:2px 8px;background:rgba(16,185,129,0.15);color:var(--reef-green);border-radius:4px;">${s}</span>`).join('')}</div>` : ''}
    ${sorted.map(obs => `<div class="obs-item" style="margin-bottom:6px;">
      ${obs.photoBlob ? `<img class="obs-thumb" src="${URL.createObjectURL(obs.photoBlob)}">` : obs.photoId ? `<img class="obs-thumb" src="${API}/image/${obs.photoId}">` : `<div class="obs-thumb" style="background:var(--card-bg);display:flex;align-items:center;justify-content:center;font-size:20px;">${eventIcon(obs.type)}</div>`}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13px;">
        <span style="font-weight:600;">${obs.type}${obs.species ? ': ' + obs.species : ''}${obs.healthScore ? ' \u2605' + obs.healthScore + '/5' : ''}</span>
        ${obs.depth ? `<span class="text-dim">\u2B07 ${obs.depth}m${obs.temperature ? ' \u00B7 \u{1F321} ' + obs.temperature + '\u00B0C' : ''}</span>` : ''}
        ${obs.notes ? `<span class="text-dim" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${obs.notes.slice(0, 60)}</span>` : ''}
        <span class="text-dim" style="font-size:11px;">${new Date(obs.timestamp).toLocaleString()}</span>
      </div></div>`).join('')}`;
  detail.querySelector('#close-hex').addEventListener('click', () => detail.classList.add('hidden'));
}
