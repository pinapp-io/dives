/**
 * Depth profile — dive-computer quality Canvas renderer.
 */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function roundRectTop(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

export function renderDepthProfile(profile, options = {}) {
  const dpr = window.devicePixelRatio || 1;
  const W = options.width || 600, H = options.height || 280;
  const canvas = document.createElement('canvas');
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const C = {
    bg: '#0a1628', bgCard: '#0d1f35', grid: 'rgba(34,211,238,0.08)', gridStrong: 'rgba(34,211,238,0.15)',
    gridText: '#475569', depthGlow: 'rgba(34,211,238,0.6)', depthLine: '#22d3ee',
    depthFillTop: 'rgba(34,211,238,0.25)', depthFillBot: 'rgba(10,77,104,0.05)',
    tempLine: '#f97316', tempGlow: 'rgba(249,115,22,0.3)',
    safetyZone: 'rgba(16,185,129,0.06)', safetyLine: 'rgba(16,185,129,0.35)', safetyText: '#10b981',
    maxDot: '#ef4444', maxGlow: 'rgba(239,68,68,0.4)',
    text: '#e0f2fe', dimText: '#94a3b8', accent: '#22d3ee', coral: '#f97316', headerBg: 'rgba(14,116,144,0.2)'
  };

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, C.bgCard); bgGrad.addColorStop(1, C.bg);
  ctx.fillStyle = bgGrad; roundRect(ctx, 0, 0, W, H, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(34,211,238,0.15)'; ctx.lineWidth = 1; roundRect(ctx, 0.5, 0.5, W - 1, H - 1, 12); ctx.stroke();

  if (profile.length < 2) {
    ctx.fillStyle = C.dimText; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Not enough data', W / 2, H / 2); return canvas;
  }

  const maxTime = Math.max(...profile.map(p => p.time));
  const maxDepth = Math.max(...profile.map(p => p.depth));
  const depthCeil = Math.ceil(maxDepth / 5) * 5 || 5;
  const totalMin = Math.round(maxTime / 60);
  const avgDepth = profile.reduce((s, p) => s + p.depth, 0) / profile.length;
  const temps = profile.filter(p => p.temp != null).map(p => p.temp);
  const hasTemp = options.showTemp !== false && temps.length > 0;
  const minTemp = hasTemp ? Math.floor(Math.min(...temps)) : 0;
  const maxTemp = hasTemp ? Math.ceil(Math.max(...temps)) : 0;
  const tempRange = (maxTemp - minTemp) || 1;

  const headerH = 52;
  const margin = { top: headerH + 8, right: hasTemp ? 52 : 16, bottom: 36, left: 44 };
  const chartW = W - margin.left - margin.right, chartH = H - margin.top - margin.bottom;
  const xScale = t => margin.left + (t / maxTime) * chartW;
  const yScale = d => margin.top + (d / depthCeil) * chartH;
  const tempY = t => margin.top + chartH - ((t - minTemp) / tempRange) * chartH;

  // Header
  ctx.fillStyle = C.headerBg; roundRectTop(ctx, 0, 0, W, headerH, 12); ctx.fill();
  ctx.fillStyle = C.accent; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(options.title || 'Dive Profile', 14, 22);

  // Stats pills
  const pills = [
    { l: 'MAX', v: `${maxDepth.toFixed(1)}m`, c: C.maxDot },
    { l: 'AVG', v: `${avgDepth.toFixed(1)}m`, c: C.accent },
    { l: 'TIME', v: `${totalMin}min`, c: C.text }
  ];
  if (hasTemp) pills.push({ l: 'TEMP', v: `${Math.min(...temps).toFixed(0)}-${Math.max(...temps).toFixed(0)}C`, c: C.coral });
  let px = W - 14;
  for (let i = pills.length - 1; i >= 0; i--) {
    const p = pills[i];
    ctx.font = 'bold 13px sans-serif'; const vw = ctx.measureText(p.v).width;
    ctx.font = '9px sans-serif'; const lw = ctx.measureText(p.l).width;
    const pw = Math.max(vw, lw) + 16; px -= pw;
    ctx.fillStyle = 'rgba(10,22,40,0.6)'; roundRect(ctx, px, 8, pw, 36, 6); ctx.fill();
    ctx.fillStyle = p.c; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.v, px + pw / 2, 26);
    ctx.fillStyle = C.gridText; ctx.font = '8px sans-serif'; ctx.fillText(p.l, px + pw / 2, 38);
    px -= 6;
  }
  ctx.textAlign = 'left';

  // Grid
  const depthStep = depthCeil <= 5 ? 1 : depthCeil <= 15 ? 2.5 : depthCeil <= 30 ? 5 : 10;
  for (let d = 0; d <= depthCeil; d += depthStep) {
    const y = yScale(d);
    ctx.strokeStyle = d === 0 ? C.gridStrong : C.grid; ctx.lineWidth = d === 0 ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(margin.left + chartW, y); ctx.stroke();
    ctx.fillStyle = C.gridText; ctx.font = '10px sans-serif'; ctx.textAlign = 'right'; ctx.fillText(`${d}m`, margin.left - 6, y + 3);
  }
  const timeStep = totalMin <= 5 ? 1 : totalMin <= 15 ? 2 : totalMin <= 30 ? 5 : 10;
  for (let t = 0; t <= maxTime; t += timeStep * 60) {
    const x = xScale(t);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, margin.top + chartH); ctx.stroke();
    ctx.fillStyle = C.gridText; ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(t / 60)}`, x, H - margin.bottom + 16);
  }
  ctx.fillStyle = C.dimText; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('minutes', margin.left + chartW / 2, H - 4);

  // Safety stop zone
  if (depthCeil > 5) {
    const sy = yScale(5);
    ctx.fillStyle = C.safetyZone; ctx.fillRect(margin.left, margin.top, chartW, sy - margin.top);
    ctx.strokeStyle = C.safetyLine; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(margin.left, sy); ctx.lineTo(margin.left + chartW, sy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.safetyText; ctx.font = '9px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('safety stop', margin.left + chartW - 4, sy - 3);
  }

  // Depth fill
  const fillGrad = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartH);
  fillGrad.addColorStop(0, C.depthFillTop); fillGrad.addColorStop(1, C.depthFillBot);
  ctx.beginPath(); ctx.moveTo(xScale(profile[0].time), yScale(0));
  for (const p of profile) ctx.lineTo(xScale(p.time), yScale(p.depth));
  ctx.lineTo(xScale(profile[profile.length - 1].time), yScale(0)); ctx.closePath();
  ctx.fillStyle = fillGrad; ctx.fill();

  // Depth line (glow + main)
  ctx.beginPath();
  for (let i = 0; i < profile.length; i++) { const p = profile[i]; i === 0 ? ctx.moveTo(xScale(p.time), yScale(p.depth)) : ctx.lineTo(xScale(p.time), yScale(p.depth)); }
  ctx.strokeStyle = C.depthGlow; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < profile.length; i++) { const p = profile[i]; i === 0 ? ctx.moveTo(xScale(p.time), yScale(p.depth)) : ctx.lineTo(xScale(p.time), yScale(p.depth)); }
  ctx.strokeStyle = C.depthLine; ctx.lineWidth = 2.5; ctx.stroke();

  // Temperature line
  if (hasTemp) {
    const tp = profile.filter(p => p.temp != null);
    if (tp.length >= 2) {
      ctx.beginPath(); tp.forEach((p, i) => { i === 0 ? ctx.moveTo(xScale(p.time), tempY(p.temp)) : ctx.lineTo(xScale(p.time), tempY(p.temp)); });
      ctx.strokeStyle = C.tempGlow; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); tp.forEach((p, i) => { i === 0 ? ctx.moveTo(xScale(p.time), tempY(p.temp)) : ctx.lineTo(xScale(p.time), tempY(p.temp)); });
      ctx.strokeStyle = C.tempLine; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]);
      const tStep = tempRange <= 3 ? 0.5 : tempRange <= 6 ? 1 : 2;
      for (let t = minTemp; t <= maxTemp; t += tStep) {
        const y = tempY(t); if (y < margin.top || y > margin.top + chartH) continue;
        ctx.fillStyle = C.coral; ctx.font = '9px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${t}\u00B0`, margin.left + chartW + 6, y + 3);
      }
    }
  }

  // Max depth marker
  const maxP = profile.reduce((m, p) => p.depth > m.depth ? p : m, profile[0]);
  const mx = xScale(maxP.time), my = yScale(maxP.depth);
  ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fillStyle = C.maxGlow; ctx.fill();
  ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.fillStyle = C.maxDot; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.stroke();
  const ml = `${maxP.depth.toFixed(1)}m`;
  ctx.font = 'bold 11px sans-serif'; const mlw = ctx.measureText(ml).width + 10;
  ctx.fillStyle = 'rgba(239,68,68,0.2)'; roundRect(ctx, mx - mlw / 2, my + 10, mlw, 18, 4); ctx.fill();
  ctx.fillStyle = C.maxDot; ctx.textAlign = 'center'; ctx.fillText(ml, mx, my + 23);

  // Entry/exit dots
  ctx.beginPath(); ctx.arc(xScale(profile[0].time), yScale(profile[0].depth), 3, 0, Math.PI * 2); ctx.fillStyle = C.safetyText; ctx.fill();
  ctx.beginPath(); ctx.arc(xScale(profile[profile.length - 1].time), yScale(profile[profile.length - 1].depth), 3, 0, Math.PI * 2); ctx.fillStyle = C.safetyText; ctx.fill();

  return canvas;
}
