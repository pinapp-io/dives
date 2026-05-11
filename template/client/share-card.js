/**
 * Share card — 1080x1080 ocean-dark PNG for social sharing.
 */
import { state } from './state.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

export async function generateShareCard() {
  const obs = state.observations;
  const size = 1080, c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#0a4d68'); grad.addColorStop(0.4, '#0a1628'); grad.addColorStop(1, '#0a1628');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);

  // Hex pattern overlay
  ctx.strokeStyle = 'rgba(34,211,238,0.12)'; ctx.lineWidth = 1;
  const hexSize = 40, hexW = hexSize * Math.sqrt(3), hexH = hexSize * 2;
  for (let row = -1; row < size / (hexH * 0.75) + 1; row++) {
    for (let col = -1; col < size / hexW + 1; col++) {
      const x = col * hexW + (row % 2 ? hexW / 2 : 0), y = row * hexH * 0.75;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + hexSize * Math.cos(a), py = y + hexSize * Math.sin(a);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }
  }

  // Badge
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(ctx, 30, 30, 220, 36, 8); ctx.fill();
  ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('\u{1F420} ReefRootz', 48, 55);

  // Stats
  const hexCount = new Set(obs.map(o => o.h3Index).filter(Boolean)).size;
  const photoCount = obs.filter(o => o.photoBlob || o.photoId).length;
  const statsY = 690;
  ctx.fillStyle = 'rgba(14,116,144,0.3)'; roundRect(ctx, 40, statsY, size - 80, 100, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(34,211,238,0.3)'; ctx.lineWidth = 1; roundRect(ctx, 40, statsY, size - 80, 100, 16); ctx.stroke();

  const stats = [
    { l: 'Photos', v: photoCount, i: '\u{1F4F7}' },
    { l: 'Hexagons', v: hexCount, i: '\u2B21' },
    { l: 'Obs', v: obs.length, i: '\u{1F4CB}' }
  ];
  const sw = (size - 120) / stats.length;
  stats.forEach((s, i) => {
    const x = 60 + i * sw + sw / 2;
    ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${s.i} ${s.v}`, x, statsY + 42);
    ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.fillText(s.l, x, statsY + 68);
  });

  // Site info
  ctx.textAlign = 'left'; ctx.fillStyle = '#e0f2fe'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`\u{1F4CD} ${state.instance?.fixedAttributes?.name || 'Dive Site'}`, 50, statsY + 140);
  ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif';
  ctx.fillText(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 50, statsY + 170);

  // Footer
  ctx.fillStyle = '#22d3ee'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Data with Origin. For every reef. Forever.', size / 2, size - 50);
  ctx.fillStyle = '#64748b'; ctx.font = '13px sans-serif'; ctx.fillText('dive.rootz.global', size / 2, size - 28);

  // Share
  c.toBlob(async blob => {
    if (navigator.share && navigator.canShare) {
      try {
        await navigator.share({ files: [new File([blob], 'reeftrootz-dive.png', { type: 'image/png' })], title: 'Dive Report' });
      } catch {}
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dive-report.png'; a.click();
    }
  }, 'image/png');
}
