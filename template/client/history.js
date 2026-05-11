/**
 * History tab — dive logs grouped by day, depth profiles, carousel, detail overlay.
 */
import { state } from './state.js';
import { API, eventIcon } from './utils.js';
import { renderDepthProfile } from './depth-profile.js';
import { generateShareCard } from './share-card.js';

export function initHistoryPage() {
  window.addEventListener('tab-change', e => { if (e.detail.tab === 'history') renderHistory(); });
}

function renderHistory() {
  const container = document.getElementById('tab-history');
  const obs = state.observations;
  if (!obs.length) { container.innerHTML = '<div class="card" style="text-align:center;"><p class="text-dim">No observations yet.</p></div>'; return; }

  const groups = new Map();
  for (const o of obs) {
    const day = new Date(o.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const existing = groups.get(day) || []; existing.push(o); groups.set(day, existing);
  }

  let html = `<div class="card" style="padding:12px 16px;"><div style="display:flex;justify-content:space-between;align-items:center;">
    <div><span style="font-weight:700;color:var(--ocean-glow);font-size:16px;">${obs.length}</span><span class="text-dim text-sm"> observations</span></div>
    <button class="btn btn-coral btn-sm" id="btn-share-all">Share</button></div></div>`;

  groups.forEach((dayObs, day) => {
    const photos = dayObs.filter(o => o.photoBlob || o.photoId);
    const diveCount = splitIntoDives(dayObs).length;
    html += `<div style="margin-top:4px;"><div class="day-header" data-day="${day}">
      <div><span style="font-weight:700;font-size:14px;color:var(--ocean-glow);">${day}</span></div>
      <div style="font-size:12px;color:var(--text-dim);display:flex;gap:10px;">
        <span>${dayObs.length} obs</span>${diveCount > 1 ? `<span>${diveCount} dives</span>` : ''}${photos.length ? `<span>${photos.length} \u{1F4F7}</span>` : ''}
        <span style="color:var(--ocean-glow);">\u25B8</span>
      </div></div>`;

    if (photos.length) {
      html += `<div class="photo-strip">`;
      for (const o of photos) {
        const src = o.photoBlob ? URL.createObjectURL(o.photoBlob) : `${API}/image/${o.photoId}`;
        html += `<img src="${src}" class="strip-thumb" data-obs-id="${o.id}">`;
      }
      html += `</div>`;
    }

    const withDepth = dayObs.filter(o => o.depth && o.depth > 0).sort((a, b) => a.timestamp - b.timestamp);
    if (withDepth.length >= 2) html += `<div class="depth-chart-slot" data-day="${day}" style="margin-top:6px;"></div>`;
    html += '</div>';
  });

  container.innerHTML = html;

  // Render depth charts
  container.querySelectorAll('.depth-chart-slot').forEach(slot => {
    const dayObs = groups.get(slot.dataset.day) || [];
    const withDepth = dayObs.filter(o => o.depth > 0).sort((a, b) => a.timestamp - b.timestamp);
    if (withDepth.length < 2) return;
    const startTime = withDepth[0].timestamp;
    const profile = withDepth.map(o => ({ time: (o.timestamp - startTime) / 1000, depth: o.depth, temp: o.temperature }));
    const canvas = renderDepthProfile(profile, { width: Math.min(container.clientWidth - 24, 600), height: 240, title: slot.dataset.day });
    canvas.style.width = '100%'; canvas.style.height = 'auto'; canvas.style.borderRadius = '10px';
    slot.appendChild(canvas);
  });

  // Day header -> dive detail overlay
  container.querySelectorAll('.day-header').forEach(header => {
    header.addEventListener('click', () => {
      showDiveDetail(groups.get(header.dataset.day) || [], header.dataset.day);
    });
  });

  container.querySelector('#btn-share-all')?.addEventListener('click', () => generateShareCard());
}

function splitIntoDives(dayObs) {
  const sorted = [...dayObs].sort((a, b) => a.timestamp - b.timestamp);
  if (!sorted.length) return [];
  const dives = [[]];
  for (const obs of sorted) {
    const cur = dives[dives.length - 1];
    if (cur.length > 0) {
      const gap = (obs.timestamp - cur[cur.length - 1].timestamp) / 60000;
      const dist = cur[cur.length - 1].gpsLat ? Math.sqrt((obs.gpsLat - cur[cur.length - 1].gpsLat) ** 2 + (obs.gpsLng - cur[cur.length - 1].gpsLng) ** 2) : 0;
      if (gap > 60 || dist > 0.01) dives.push([]);
    }
    dives[dives.length - 1].push(obs);
  }
  return dives;
}

function showDiveDetail(dayObs, dayLabel) {
  const photosObs = dayObs.filter(o => o.photoBlob || o.photoId);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:var(--ocean-dark);z-index:900;display:flex;flex-direction:column;overflow-y:auto;';

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--ocean-mid);border-bottom:1px solid var(--border);flex-shrink:0;">
    <div><div style="font-weight:700;font-size:16px;color:var(--ocean-glow);">${state.instance?.fixedAttributes?.name || 'Dive'}</div>
      <div style="font-size:12px;color:var(--text-dim);">${dayLabel} \u00B7 ${dayObs.length} observations</div></div>
    <button id="detail-close" style="background:rgba(255,255,255,0.1);border:none;color:var(--text);font-size:20px;width:36px;height:36px;border-radius:8px;cursor:pointer;">\u2715</button></div>`;

  // Photo carousel
  if (photosObs.length) {
    html += `<div style="flex-shrink:0;position:relative;"><div id="carousel-vp" style="width:100%;aspect-ratio:4/3;overflow:hidden;background:#000;position:relative;">
      <div id="carousel-track" style="display:flex;height:100%;transition:transform 0.3s ease-out;">`;
    for (const obs of photosObs) {
      const src = obs.photoBlob ? URL.createObjectURL(obs.photoBlob) : `${API}/image/${obs.photoId}`;
      html += `<div style="min-width:100%;height:100%;flex-shrink:0;position:relative;">
        <img src="${src}" style="width:100%;height:100%;object-fit:cover;">
        <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 12px;background:linear-gradient(transparent,rgba(0,0,0,0.8));">
          <div style="font-size:13px;font-weight:600;color:#fff;">${obs.type}${obs.species ? ' : ' + obs.species : ''}</div>
          ${obs.depth ? `<span style="font-size:11px;color:rgba(255,255,255,0.7);">${obs.depth}m</span>` : ''}</div></div>`;
    }
    html += `</div></div>`;
    if (photosObs.length > 1) {
      html += `<button id="car-prev" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;z-index:2;">\u2039</button>
        <button id="car-next" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;z-index:2;">\u203A</button>`;
      html += `<div id="car-dots" style="display:flex;justify-content:center;gap:6px;padding:8px 0;">${photosObs.map((_, i) => `<div class="car-dot" data-idx="${i}" style="width:8px;height:8px;border-radius:50%;background:${i === 0 ? 'var(--ocean-glow)' : 'rgba(255,255,255,0.3)'};cursor:pointer;"></div>`).join('')}</div>`;
    }
    html += `</div>`;
  }

  // Depth profile
  const withDepth = dayObs.filter(o => o.depth > 0).sort((a, b) => a.timestamp - b.timestamp);
  if (withDepth.length >= 2) html += `<div id="detail-profile" style="padding:8px 12px;"></div>`;

  // All observations
  html += `<div style="padding:8px 12px;"><div style="font-size:10px;color:var(--text-dim);margin-bottom:6px;">ALL OBSERVATIONS</div>`;
  for (const obs of dayObs) {
    html += `<div style="display:flex;gap:10px;padding:8px;margin-bottom:4px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:12px;">
      <div style="flex-shrink:0;width:20px;text-align:center;">${eventIcon(obs.type)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;">${obs.type}${obs.species ? ': ' + obs.species : ''}${obs.healthScore ? ' \u2605' + obs.healthScore + '/5' : ''}</div>
        ${obs.notes ? `<div class="text-dim" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${obs.notes}</div>` : ''}
        <div class="text-dim" style="font-size:11px;">${obs.depth ? obs.depth + 'm' : ''}${obs.temperature ? ' \u00B7 ' + obs.temperature + '\u00B0C' : ''} \u00B7 ${new Date(obs.timestamp).toLocaleTimeString()}</div>
      </div></div>`;
  }
  html += `</div><div style="height:40px;"></div>`;

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  // Depth profile render
  if (withDepth.length >= 2) {
    const startTime = withDepth[0].timestamp;
    const profile = withDepth.map(o => ({ time: (o.timestamp - startTime) / 1000, depth: o.depth, temp: o.temperature }));
    const canvas = renderDepthProfile(profile, { width: Math.min(window.innerWidth - 24, 600), height: 240, title: state.instance?.fixedAttributes?.name || 'Dive', showTemp: true });
    canvas.style.width = '100%'; canvas.style.height = 'auto';
    overlay.querySelector('#detail-profile')?.appendChild(canvas);
  }

  // Carousel logic
  if (photosObs.length > 1) {
    let idx = 0;
    const track = overlay.querySelector('#carousel-track');
    const dots = overlay.querySelectorAll('.car-dot');
    const goTo = i => { idx = Math.max(0, Math.min(i, photosObs.length - 1)); track.style.transform = `translateX(-${idx * 100}%)`; dots.forEach((d, j) => d.style.background = j === idx ? 'var(--ocean-glow)' : 'rgba(255,255,255,0.3)'); };
    overlay.querySelector('#car-prev')?.addEventListener('click', e => { e.stopPropagation(); goTo(idx - 1); });
    overlay.querySelector('#car-next')?.addEventListener('click', e => { e.stopPropagation(); goTo(idx + 1); });
    dots.forEach(d => d.addEventListener('click', e => { e.stopPropagation(); goTo(parseInt(d.dataset.idx)); }));
    // Touch swipe
    let sx = 0, swiping = false;
    const vp = overlay.querySelector('#carousel-vp');
    vp?.addEventListener('touchstart', e => { sx = e.touches[0].clientX; swiping = false; track.style.transition = 'none'; }, { passive: true });
    vp?.addEventListener('touchmove', e => { const dx = e.touches[0].clientX - sx; if (Math.abs(dx) > 10) { swiping = true; track.style.transform = `translateX(${-idx * vp.clientWidth + dx}px)`; } }, { passive: true });
    vp?.addEventListener('touchend', e => { track.style.transition = 'transform 0.3s ease-out'; if (swiping) { const dx = e.changedTouches[0].clientX - sx; if (dx < -50) goTo(idx + 1); else if (dx > 50) goTo(idx - 1); else goTo(idx); } });
  }

  overlay.querySelector('#detail-close').addEventListener('click', () => overlay.remove());
}
