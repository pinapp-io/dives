/**
 * Capture tab — camera, EXIF GPS, gallery import, observation form.
 */
import { state } from './state.js';
import { API, showToast, generateId, blobToBase64 } from './utils.js';
import { dbSave, refreshObservations, syncToPinapp } from './store.js';
import { detectSite } from './site-packages.js';
import { renderHome } from './home.js';

let capturedBlob = null;
let exifGps = null;
let pendingImports = [];
let h3Module = null;

export function initCapturePage(h3) {
  h3Module = h3;
  const container = document.getElementById('tab-capture');
  container.innerHTML = `
    <div class="capture-preview" id="capture-preview">
      <video id="camera-feed" autoplay playsinline muted style="display:none;"></video>
      <div class="hex-overlay" id="hex-overlay">No GPS</div>
      <div id="cam-placeholder" style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;text-align:center;padding:20px;">\u{1F4F7} Tap Start Camera or choose from Gallery</div>
    </div>
    <div class="gps-status" id="gps-status"><span>\u{1F4CD}</span> <span id="gps-text">Acquiring GPS...</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-coral" id="btn-start-cam" style="flex:1;min-width:100px;">Start Camera</button>
      <button class="btn btn-primary" id="btn-capture" style="flex:1;min-width:100px;display:none;">\u{1F4F7} Take Photo</button>
      <button class="btn btn-primary" id="btn-gallery" style="flex:1;min-width:100px;">\u{1F5BC}\uFE0F Gallery</button>
    </div>
    <input type="file" id="gallery-input" accept="image/*" multiple style="display:none;">
    <div id="batch-status" class="card hidden"><div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="text-sm" id="batch-text">0 photos</span>
      <button class="btn btn-success btn-sm" id="btn-save-batch">Save All</button>
    </div><div id="batch-thumbs" class="photo-strip mt-2"></div></div>
    <div id="capture-photo-preview" class="photo-strip"></div>
    <div id="observation-form" class="card hidden">
      <div id="captured-img-preview" style="margin-bottom:8px;"></div>
      <div class="form-group"><label>Type</label>
        <select id="obs-type">
          <option value="photo">Photo</option>
          <option value="health">Reef Health</option>
          <option value="species">Species Sighting</option>
          <option value="temperature">Temperature</option>
          <option value="general">General Note</option>
        </select></div>
      <div class="form-group mt-2" id="species-group" style="display:none;"><label>Species</label><input type="text" id="obs-species" placeholder="e.g., Staghorn coral, Blue tang"></div>
      <div class="form-group mt-2" id="health-group" style="display:none;"><label>Health Score (1=dead/bleached, 5=excellent)</label>
        <div class="health-picker"><div class="health-chip" data-v="1">1</div><div class="health-chip" data-v="2">2</div><div class="health-chip" data-v="3">3</div><div class="health-chip" data-v="4">4</div><div class="health-chip" data-v="5">5</div></div>
        <input type="hidden" id="obs-health" value=""></div>
      <div class="form-group mt-2" id="temp-group" style="display:none;"><label>Water Temperature (\u00B0C)</label><input type="number" id="obs-temp" step="0.1" placeholder="27.5"></div>
      <div class="form-group mt-2"><label>Depth (m)</label><input type="number" id="obs-depth" step="0.1" placeholder="12.5"></div>
      <div class="form-group mt-2"><label>Notes</label><textarea id="obs-notes" rows="2" placeholder="What did you see?"></textarea></div>
      <div id="exif-info" class="hidden" style="margin-top:8px;padding:8px;background:rgba(34,211,238,0.1);border-radius:8px;">
        <span class="text-sm text-glow">\u{1F4CD} GPS from photo EXIF: </span><span class="text-sm" id="exif-coords"></span></div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-success btn-full" id="btn-save-obs">Save Observation</button>
        <button class="btn btn-primary" id="btn-retake" style="flex:0 0 auto;">Back</button>
      </div>
    </div>
    <canvas id="capture-canvas" style="display:none;"></canvas>`;

  // Type selector toggles extra fields
  container.querySelector('#obs-type').addEventListener('change', e => {
    const type = e.target.value;
    container.querySelector('#species-group').style.display = type === 'species' ? '' : 'none';
    container.querySelector('#health-group').style.display = type === 'health' ? '' : 'none';
    container.querySelector('#temp-group').style.display = type === 'temperature' ? '' : 'none';
  });

  // Health chips
  container.querySelectorAll('.health-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.health-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      container.querySelector('#obs-health').value = chip.dataset.v;
    });
  });

  container.querySelector('#btn-start-cam').addEventListener('click', toggleCamera);
  container.querySelector('#btn-capture').addEventListener('click', captureFromCamera);
  container.querySelector('#btn-gallery').addEventListener('click', () => container.querySelector('#gallery-input').click());
  container.querySelector('#gallery-input').addEventListener('change', handleGallerySelect);
  container.querySelector('#btn-save-obs').addEventListener('click', saveCurrentObservation);
  container.querySelector('#btn-save-batch').addEventListener('click', saveBatchObservations);
  container.querySelector('#btn-retake').addEventListener('click', resetCapture);

  window.addEventListener('tab-change', e => {
    if (e.detail.tab === 'capture') { if (!state.videoStream) startCamera(); }
    else if (state.videoStream) { state.videoStream.getTracks().forEach(t => t.stop()); state.videoStream = null; }
  });

  startGps();
}

async function toggleCamera() {
  if (state.videoStream) {
    state.videoStream.getTracks().forEach(t => t.stop()); state.videoStream = null;
    document.getElementById('camera-feed').style.display = 'none';
    document.getElementById('cam-placeholder').style.display = '';
    document.getElementById('btn-start-cam').textContent = 'Start Camera';
    document.getElementById('btn-capture').style.display = 'none';
  } else {
    await startCamera();
  }
}

async function startCamera() {
  try {
    const video = document.getElementById('camera-feed');
    state.videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
    video.srcObject = state.videoStream; video.style.display = '';
    document.getElementById('cam-placeholder').style.display = 'none';
    document.getElementById('btn-start-cam').textContent = 'Stop Camera';
    document.getElementById('btn-capture').style.display = '';
  } catch {
    document.getElementById('cam-placeholder').innerHTML = '\u{1F4F7} Camera not available.<br><br>Use <strong>Gallery</strong> to import photos.';
  }
}

function captureFromCamera() {
  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('capture-canvas');
  canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(blob => {
    if (!blob) return;
    capturedBlob = blob; exifGps = null;
    showSingleForm(blob, null);
  }, 'image/jpeg', 0.85);
}

function startGps() {
  if (!navigator.geolocation) { document.getElementById('gps-text').textContent = 'GPS not available'; return; }
  navigator.geolocation.watchPosition(pos => {
    state.currentGps = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    document.getElementById('gps-text').textContent = `${state.currentGps.lat.toFixed(5)}, ${state.currentGps.lng.toFixed(5)}`;
    document.getElementById('gps-status').classList.add('locked');
    try {
      const hex = h3Module.latLngToCell(state.currentGps.lat, state.currentGps.lng, 10);
      document.getElementById('hex-overlay').textContent = `H3: ${hex.slice(0, 10)}...`;
    } catch {}
    if (!state.currentSite) detectSite(state.currentGps.lat, state.currentGps.lng);
  }, err => {
    document.getElementById('gps-text').textContent = `GPS error: ${err.message}`;
  }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 });
}

// ---- EXIF GPS extraction ----

async function extractExifGps(blob) {
  try {
    const buffer = await blob.arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xFFD8) return null;
    let offset = 2;
    while (offset < view.byteLength - 2) {
      const marker = view.getUint16(offset);
      if (marker === 0xFFE1) {
        const length = view.getUint16(offset + 2);
        const exifData = new DataView(buffer, offset + 4, length - 2);
        return parseExifGps(exifData);
      }
      if ((marker & 0xFF00) !== 0xFF00) break;
      offset += 2 + view.getUint16(offset + 2);
    }
    return null;
  } catch { return null; }
}

function parseExifGps(data) {
  try {
    const exifStr = String.fromCharCode(data.getUint8(0), data.getUint8(1), data.getUint8(2), data.getUint8(3));
    if (exifStr !== 'Exif') return null;
    const tiffStart = 6;
    const littleEndian = data.getUint16(tiffStart) === 0x4949;
    const ifd0Offset = data.getUint32(tiffStart + 4, littleEndian);
    const ifd0Count = data.getUint16(tiffStart + ifd0Offset, littleEndian);
    let gpsIfdOffset = 0;
    for (let i = 0; i < ifd0Count; i++) {
      const entryOffset = tiffStart + ifd0Offset + 2 + i * 12;
      if (data.getUint16(entryOffset, littleEndian) === 0x8825) { gpsIfdOffset = data.getUint32(entryOffset + 8, littleEndian); break; }
    }
    if (!gpsIfdOffset) return null;
    const gpsCount = data.getUint16(tiffStart + gpsIfdOffset, littleEndian);
    let latRef = '', lngRef = '', latR = [], lngR = [];
    for (let i = 0; i < gpsCount; i++) {
      const eo = tiffStart + gpsIfdOffset + 2 + i * 12;
      const tag = data.getUint16(eo, littleEndian);
      const vo = data.getUint32(eo + 8, littleEndian);
      if (tag === 1) latRef = String.fromCharCode(data.getUint8(eo + 8));
      else if (tag === 2) latR = readRationals(data, tiffStart + vo, 3, littleEndian);
      else if (tag === 3) lngRef = String.fromCharCode(data.getUint8(eo + 8));
      else if (tag === 4) lngR = readRationals(data, tiffStart + vo, 3, littleEndian);
    }
    if (latR.length !== 3 || lngR.length !== 3) return null;
    let lat = latR[0] + latR[1] / 60 + latR[2] / 3600;
    let lng = lngR[0] + lngR[1] / 60 + lngR[2] / 3600;
    if (latRef === 'S') lat = -lat;
    if (lngRef === 'W') lng = -lng;
    if (lat === 0 && lng === 0) return null;
    return { lat, lng };
  } catch { return null; }
}

function readRationals(data, offset, count, le) {
  const vals = [];
  for (let i = 0; i < count; i++) {
    const num = data.getUint32(offset + i * 8, le);
    const den = data.getUint32(offset + i * 8 + 4, le);
    vals.push(den === 0 ? 0 : num / den);
  }
  return vals;
}

// ---- Gallery handling ----

async function handleGallerySelect(e) {
  const files = e.target.files;
  if (!files || !files.length) return;
  pendingImports = [];
  if (files.length === 1) {
    const file = files[0];
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });
    const gps = await extractExifGps(blob);
    capturedBlob = blob; exifGps = gps;
    showSingleForm(blob, gps);
  } else {
    for (const file of Array.from(files)) {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      const gps = await extractExifGps(blob);
      pendingImports.push({ blob, exifGps: gps, filename: file.name, timestamp: file.lastModified || Date.now() });
    }
    showBatchPreview();
  }
  e.target.value = '';
}

function showSingleForm(blob, gps) {
  document.getElementById('camera-feed').style.display = 'none';
  document.getElementById('batch-status').classList.add('hidden');
  document.getElementById('captured-img-preview').innerHTML = `<img src="${URL.createObjectURL(blob)}" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover;">`;
  const exifInfo = document.getElementById('exif-info');
  if (gps) { exifInfo.classList.remove('hidden'); document.getElementById('exif-coords').textContent = `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`; }
  else { exifInfo.classList.add('hidden'); }
  document.getElementById('observation-form').classList.remove('hidden');
}

function showBatchPreview() {
  document.getElementById('observation-form').classList.add('hidden');
  const batchEl = document.getElementById('batch-status');
  batchEl.classList.remove('hidden');
  document.getElementById('batch-text').textContent = `${pendingImports.length} photos (${pendingImports.filter(p => p.exifGps).length} with GPS)`;
  const thumbs = document.getElementById('batch-thumbs');
  thumbs.innerHTML = '';
  for (const imp of pendingImports) {
    const div = document.createElement('div');
    div.style.cssText = 'position:relative;width:60px;height:60px;border-radius:6px;overflow:hidden;flex-shrink:0;';
    div.innerHTML = `<img src="${URL.createObjectURL(imp.blob)}" style="width:100%;height:100%;object-fit:cover;">`;
    if (imp.exifGps) {
      const b = document.createElement('div');
      b.style.cssText = 'position:absolute;bottom:2px;right:2px;background:rgba(34,197,94,0.9);color:white;font-size:8px;padding:1px 3px;border-radius:3px;';
      b.textContent = '\u{1F4CD}'; div.appendChild(b);
    }
    thumbs.appendChild(div);
  }
}

function resetCapture() {
  document.getElementById('observation-form').classList.add('hidden');
  document.getElementById('batch-status').classList.add('hidden');
  document.getElementById('captured-img-preview').innerHTML = '';
  document.getElementById('capture-photo-preview').innerHTML = '';
  if (state.videoStream) document.getElementById('camera-feed').style.display = '';
  else document.getElementById('cam-placeholder').style.display = '';
  capturedBlob = null; exifGps = null;
}

async function saveCurrentObservation() {
  const gps = exifGps || state.currentGps;
  if (!gps) { showToast('No GPS available'); return; }
  const container = document.getElementById('tab-capture');
  const type = container.querySelector('#obs-type').value;
  const notes = container.querySelector('#obs-notes').value;
  const species = container.querySelector('#obs-species').value;
  const health = container.querySelector('#obs-health').value;
  const temp = container.querySelector('#obs-temp').value;
  const depth = container.querySelector('#obs-depth').value;

  const id = generateId();
  let h3Index = '';
  try { h3Index = h3Module.latLngToCell(gps.lat, gps.lng, 10); } catch {}

  let photoId = null;
  if (capturedBlob) {
    try {
      const base64 = await blobToBase64(capturedBlob);
      const r = await fetch(`${API}/image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: base64 }) });
      if (r.ok) photoId = (await r.json()).id;
    } catch {}
  }

  const obs = {
    id, timestamp: Date.now(), type, gpsLat: gps.lat, gpsLng: gps.lng, h3Index,
    photoBlob: capturedBlob || undefined, photoId,
    species: species || undefined, healthScore: health ? parseInt(health) : undefined,
    temperature: temp ? parseFloat(temp) : undefined, depth: depth ? parseFloat(depth) : undefined,
    notes: notes || undefined, syncStatus: 'local',
  };

  await dbSave(obs);
  syncToPinapp(obs);
  await refreshObservations();
  resetCapture();
  showToast('Observation saved');
  renderHome();
}

async function saveBatchObservations() {
  const btn = document.getElementById('btn-save-batch');
  btn.disabled = true; btn.textContent = 'Saving...';
  let saved = 0;
  for (const imp of pendingImports) {
    const gps = imp.exifGps || state.currentGps;
    if (!gps) continue;
    const id = generateId();
    let h3Index = '';
    try { h3Index = h3Module.latLngToCell(gps.lat, gps.lng, 10); } catch {}
    let photoId = null;
    try {
      const base64 = await blobToBase64(imp.blob);
      const r = await fetch(`${API}/image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: base64 }) });
      if (r.ok) photoId = (await r.json()).id;
    } catch {}
    const obs = { id, timestamp: imp.timestamp, type: 'photo', gpsLat: gps.lat, gpsLng: gps.lng, h3Index, photoBlob: imp.blob, photoId, notes: `Imported: ${imp.filename}`, syncStatus: 'local' };
    await dbSave(obs);
    syncToPinapp(obs);
    saved++;
    btn.textContent = `Saving... ${saved}/${pendingImports.length}`;
  }
  pendingImports = [];
  document.getElementById('batch-status').classList.add('hidden');
  btn.disabled = false; btn.textContent = 'Save All';
  await refreshObservations();
  showToast(`${saved} photos saved`);
  renderHome();
}
