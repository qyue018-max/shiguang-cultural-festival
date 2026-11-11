export function createKeepsakeLayout(planet = {}) {
  const message = String(planet.message || '愿你始终保有追逐微光的勇气');
  return {
    title: planet.planetName || '未命名星球',
    identity: planet.futureIdentity || '未来探索者',
    keywords: (planet.keywords || []).slice(0, 3).join(' · '),
    message: message.length > 60 ? `${message.slice(0, 60)}…` : message,
  };
}

export function keepsakeFileName(planet = {}) {
  const safe = String(planet.planetName || '我的星球').replace(/[\\/:*?"<>|\s]+/g, '');
  return `拾光星河-${safe || '我的星球'}.png`;
}

export function renderKeepsake(canvas, planet = {}, nickname = '拾光者') {
  const width = 900, height = 1600, ctx = canvas.getContext('2d');
  canvas.width = width; canvas.height = height;
  const info = createKeepsakeLayout(planet);
  const gradient = ctx.createRadialGradient(width * .5, height * .38, 10, width * .5, height * .45, height * .75);
  gradient.addColorStop(0, planet.palette?.secondary || '#34247c'); gradient.addColorStop(.45, '#101538'); gradient.addColorStop(1, '#03040a');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  let seed = planet.seed || 77;
  for (let i = 0; i < 220; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const x = seed % width; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const y = seed % height; ctx.globalAlpha = .2 + (seed % 60) / 100; ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1 + seed % 3, 1 + seed % 3); }
  ctx.globalAlpha = 1;
  const pg = ctx.createRadialGradient(390, 535, 35, 450, 600, 285);
  pg.addColorStop(0, planet.palette?.highlight || '#e7f7ff'); pg.addColorStop(.25, planet.palette?.primary || '#55bdff'); pg.addColorStop(.7, planet.palette?.secondary || '#5740a8'); pg.addColorStop(1, '#080b22');
  ctx.shadowColor = planet.palette?.primary || '#6faaff'; ctx.shadowBlur = 70; ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(450, 610, 245, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,220,160,.75)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(450, 610, 350, 92, -.2, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#eef2ff'; ctx.font = '44px serif'; ctx.fillText('拾 光 星 河', 450, 130);
  ctx.fillStyle = '#9fa9ca'; ctx.font = '24px sans-serif'; ctx.fillText('拾起此刻的光，照见未来的你', 450, 178);
  ctx.fillStyle = '#ffffff'; ctx.font = '70px serif'; ctx.fillText(info.title, 450, 1010);
  ctx.fillStyle = '#c7d3f4'; ctx.font = '31px sans-serif'; ctx.fillText(info.identity, 450, 1070);
  ctx.fillStyle = '#ffdca0'; ctx.font = '27px sans-serif'; ctx.fillText(info.keywords, 450, 1135);
  ctx.fillStyle = '#e7ebfa'; ctx.font = '30px serif'; ctx.fillText(`“${info.message}”`, 450, 1250, 760);
  ctx.fillStyle = '#8d98b8'; ctx.font = '23px sans-serif'; ctx.fillText(nickname, 450, 1370);
  ctx.strokeStyle = 'rgba(160,180,230,.35)'; ctx.strokeRect(48, 48, width - 96, height - 96);
  return canvas;
}
