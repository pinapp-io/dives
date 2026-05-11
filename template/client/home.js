/**
 * Home tab — stats, site packages, species photos, QR code.
 */
import { state } from './state.js';
import { getSpeciesPhotos } from './species-photos.js';
import { showToast } from './utils.js';

// Shared pinapp logo + QR widget from @pinapp-io/harness. Kicked off at
// module load so the <pinapp-qr> custom element is defined by the time
// the home tab renders. Print/share helpers are awaited on click.
const MOUNT = window.location.pathname.replace(/\/[^/]*\/?$/, '');
const harnessReady = import(`${MOUNT}/harness/pinapp-qr.js`);

export function renderHome() {
  const container = document.getElementById('tab-home');
  const obs = state.observations;
  const f = state.instance?.fixedAttributes || {};
  const hexCount = new Set(obs.map(o => o.h3Index).filter(Boolean)).size;
  const photoCount = obs.filter(o => o.photoBlob || o.photoId).length;
  const todayStr = new Date().toLocaleDateString();
  const todayObs = obs.filter(o => new Date(o.timestamp).toLocaleDateString() === todayStr);

  let html = `
    <div class="card" style="text-align:center;padding:24px 16px;">
      <div style="font-size:40px;margin-bottom:8px;">\u{1F420}\u{1F30A}</div>
      <h2 style="color:var(--ocean-glow);font-size:20px;">${f.name || 'Dive Site'}</h2>
      <p class="text-dim text-sm" style="margin-top:4px;">${f.shopName || ''} ${f.region ? '\u00B7 ' + f.region : ''}</p>
    </div>`;

  if (todayObs.length > 0) {
    html += `<div class="card"><h3 class="text-sm" style="color:var(--ocean-glow);margin-bottom:8px;">Today</h3>
      <div style="display:flex;justify-content:space-around;text-align:center;">
        <div><div style="font-size:24px;font-weight:700;color:var(--ocean-glow);">${todayObs.length}</div><div class="text-dim text-sm">observations</div></div>
        <div><div style="font-size:24px;font-weight:700;color:var(--reef-green);">${new Set(todayObs.map(o => o.h3Index).filter(Boolean)).size}</div><div class="text-dim text-sm">hexagons</div></div>
      </div></div>`;
  }

  html += `<div class="card"><h3 class="text-sm" style="color:var(--ocean-glow);margin-bottom:8px;">All Time</h3>
    <div style="display:flex;justify-content:space-around;text-align:center;">
      <div><div style="font-size:24px;font-weight:700;color:var(--ocean-glow);">${obs.length}</div><div class="text-dim text-sm">observations</div></div>
      <div><div style="font-size:24px;font-weight:700;color:var(--reef-green);">${hexCount}</div><div class="text-dim text-sm">hexagons</div></div>
      <div><div style="font-size:24px;font-weight:700;color:var(--sand);">${photoCount}</div><div class="text-dim text-sm">photos</div></div>
    </div></div>`;

  html += `<div style="display:flex;gap:8px;">
    <button class="btn btn-coral btn-full" id="btn-go-capture">\u{1F4F7} Capture</button>
    <button class="btn btn-primary btn-full" id="btn-go-import">\u{1F4E5} Import</button>
  </div>`;

  // Site packages
  if (state.sitePackages.length > 0) {
    html += `<div class="card"><h3 class="text-sm" style="color:var(--ocean-glow);margin-bottom:8px;">Dive Sites</h3>`;
    state.sitePackages.forEach((s, i) => {
      html += `<div class="site-row" data-idx="${i}" style="cursor:pointer;padding:10px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div style="font-weight:700;font-size:14px;">${s.name}</div>
            <div class="text-dim text-sm">${s.location || ''}</div>
            <div class="text-dim text-sm">Max ${s.maxDepth}m \u00B7 ${s.speciesChecklist?.length || 0} species</div>
          </div><div class="text-dim" style="font-size:16px;">\u25B8</div>
        </div>
        <div class="site-detail" style="display:none;"></div>
      </div>`;
    });
    html += `</div>`;
  }

  // QR — shared <pinapp-qr> from the harness. URL is intentionally not
  // shown on screen; users can copy it via Share or read it from the printed tag.
  if (state.instance?.qrCode) {
    html += `<div class="card" style="text-align:center;">
      <h3 class="text-sm" style="color:var(--ocean-glow);margin-bottom:8px;">QR Tag</h3>
      <pinapp-qr id="qr-tag" src="${state.instance.qrCode}" style="--pinapp-qr-size:200px;"></pinapp-qr>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
        <button class="btn btn-primary" id="qr-print-btn" style="padding:8px 18px;font-size:13px;">Print</button>
        <button class="btn btn-primary" id="qr-share-btn" style="padding:8px 18px;font-size:13px;">Share</button>
      </div>
    </div>`;
  }

  container.innerHTML = html;

  // Event handlers
  container.querySelector('#btn-go-capture')?.addEventListener('click', () => document.querySelector('[data-tab="capture"]').click());
  container.querySelector('#btn-go-import')?.addEventListener('click', () => document.querySelector('[data-tab="import"]').click());
  container.querySelector('#qr-print-btn')?.addEventListener('click', async () => {
    const i = state.instance;
    if (!i?.qrCode) return;
    const { printPinappQR } = await harnessReady;
    const title = i.fixedAttributes?.name || 'Dive Site';
    if (!printPinappQR({ qrCode: i.qrCode, qrUrl: i.qrUrl, title })) {
      showToast('Pop-up blocked');
    }
  });
  container.querySelector('#qr-share-btn')?.addEventListener('click', async () => {
    const url = state.instance?.qrUrl;
    if (!url) return;
    const { sharePinappQR } = await harnessReady;
    const ok = await sharePinappQR(url);
    showToast(ok ? 'Link copied' : 'Could not copy');
  });

  // Site row expand
  container.querySelectorAll('.site-row').forEach(row => {
    row.addEventListener('click', async () => {
      const idx = parseInt(row.dataset.idx);
      const detail = row.querySelector('.site-detail');
      if (detail.style.display !== 'none') { detail.style.display = 'none'; return; }
      container.querySelectorAll('.site-detail').forEach(d => d.style.display = 'none');
      detail.style.display = 'block';
      detail.innerHTML = '<div class="text-dim text-sm" style="padding:12px 0;">Loading species photos...</div>';
      await renderSiteDetail(detail, state.sitePackages[idx]);
    });
  });
}

async function renderSiteDetail(container, site) {
  const speciesList = site.speciesChecklist || [];
  const photos = await getSpeciesPhotos(speciesList.slice(0, 12));
  const month = new Date().getMonth();
  let seasonalNote = '';
  const sn = site.seasonalNotes;
  if (sn) {
    if (month <= 3) seasonalNote = sn['jan-apr'] || '';
    else if (month <= 5) seasonalNote = sn['may-jun'] || '';
    else if (month <= 9) seasonalNote = sn['jul-oct'] || '';
    else seasonalNote = sn['nov-dec'] || '';
  }

  let html = '<div style="padding:12px 0;">';
  if (site.description) html += `<p style="font-size:13px;line-height:1.5;margin-bottom:12px;">${site.description}</p>`;
  if (seasonalNote) html += `<div style="background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.2);border-radius:8px;padding:10px;margin-bottom:12px;">
    <div style="font-weight:700;font-size:12px;color:var(--ocean-glow);margin-bottom:4px;">Current Season</div>
    <div style="font-size:13px;">${seasonalNote}</div></div>`;

  if (site.diveSites?.length) {
    html += `<div style="margin-bottom:12px;"><div style="font-weight:700;font-size:13px;color:var(--ocean-glow);margin-bottom:6px;">Dive Profiles</div>`;
    for (const ds of site.diveSites) {
      html += `<div style="padding:8px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;">
        <div style="display:flex;justify-content:space-between;"><span style="font-weight:600;font-size:13px;">${ds.name}</span><span class="text-dim text-sm">${ds.depth} \u00B7 ${ds.level}</span></div>
        <div class="text-dim text-sm mt-2">${ds.description}</div></div>`;
    }
    html += '</div>';
  }

  if (site.conservationAuthority) {
    html += `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:10px;margin-bottom:12px;">
      <div style="font-weight:700;font-size:12px;color:var(--reef-green);margin-bottom:2px;">Conservation Authority</div>
      <div style="font-size:13px;">${site.conservationAuthority}</div></div>`;
  }

  if (speciesList.length) {
    html += `<div><div style="font-weight:700;font-size:13px;color:var(--ocean-glow);margin-bottom:6px;">Species Checklist (${speciesList.length})</div>`;
    for (const sp of speciesList) {
      const photo = photos.get(sp);
      const commonName = sp.split('(')[0].trim();
      const sciName = sp.match(/\(([^)]+)\)/)?.[1] || '';
      if (photo?.photoUrl) {
        html += `<a href="${photo.wikiUrl}" target="_blank" class="species-card">
          <img src="${photo.photoUrl}" loading="lazy">
          <div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:13px;">${commonName}</div>
          ${sciName ? `<div style="font-size:11px;font-style:italic;color:var(--text-dim);">${sciName}</div>` : ''}</div>
          <div style="font-size:12px;color:var(--ocean-glow);">\u2197</div></a>`;
      } else {
        html += `<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px;">${commonName}${sciName ? ` <em class="text-dim">${sciName}</em>` : ''}</div>`;
      }
    }
    html += '</div>';
  }

  html += `<div style="margin-top:12px;font-size:11px;color:var(--text-dim);font-family:monospace;">GPS: ${site.centerLat.toFixed(5)}, ${site.centerLng.toFixed(5)}</div></div>`;
  container.innerHTML = html;
}
