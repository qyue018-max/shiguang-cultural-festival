function hashText(value) {
  let hash = 2166136261;
  for (const char of String(value)) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

const PALETTES = {
  blue: { primary: '#49b9ff', secondary: '#3156d8', highlight: '#d7f4ff' },
  violet: { primary: '#9d68ff', secondary: '#5229a8', highlight: '#f1d8ff' },
  gold: { primary: '#ffc86b', secondary: '#b8662f', highlight: '#fff1c7' },
};
const PREFIX = ['曙光', '远航', '织梦', '星语', '新生', '逐光', '澄明', '无界'];
const SUFFIX = ['之星', '星环', '秘境', '灯塔', '方舟', '行星'];

function dominantColor(colors = {}) {
  return ['blue', 'violet', 'gold'].sort((a, b) => (colors[b] || 0) - (colors[a] || 0))[0];
}
function identityFor(text) {
  if (/海洋|深海|环境|自然/.test(text)) return '未来生态守护者';
  if (/设计|创意|艺术|创造/.test(text)) return '星际创意设计师';
  if (/科技|人工智能|代码|研究/.test(text)) return '未来科技探索者';
  if (/教育|帮助|治愈|医生/.test(text)) return '温暖连接者';
  return '未知边界探索者';
}
function keywordsFor(text, color) {
  const pool = [];
  if (/创造|设计|艺术/.test(text)) pool.push('创造');
  if (/探索|未知|宇宙|研究/.test(text)) pool.push('探索');
  if (/勇敢|勇气|行动/.test(text)) pool.push('勇气');
  if (/温柔|帮助|共情|守护/.test(text)) pool.push('共鸣');
  if (/自由|远方|旅行/.test(text)) pool.push('自由');
  pool.push(color === 'gold' ? '热望' : color === 'violet' ? '想象' : '好奇', '成长', '连接');
  return [...new Set(pool)].slice(0, 3);
}

export function generatePlanet({ answers = [], stats = {} } = {}) {
  const text = answers.join('|');
  const seed = hashText(`${text}|${JSON.stringify(stats.colors || {})}|${stats.total || 0}`);
  const color = dominantColor(stats.colors);
  const palette = PALETTES[color];
  return {
    id: `planet-${seed.toString(36)}`,
    seed,
    planetName: `${PREFIX[seed % PREFIX.length]}${SUFFIX[(seed >>> 4) % SUFFIX.length]}`,
    futureIdentity: identityFor(text),
    keywords: keywordsFor(text, color),
    message: String(answers[2] || '愿你始终保有追逐微光的勇气').slice(0, 80),
    palette,
    halo: Math.min(1, 0.4 + (stats.total || 0) / 60),
    rings: Math.min(3, Math.floor((stats.bestCombo || 0) / 3)),
    ringTilt: 12 + seed % 48,
    rotationSpeed: Math.min(0.01, 0.001 + (stats.averageSpeed || 0) * 0.0015),
  };
}
