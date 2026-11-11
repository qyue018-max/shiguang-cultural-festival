const STORAGE_KEY = 'shiguang-light-points-v1';

const COLLEGES = ['新闻与传播学院', '设计学院', '计算机学院', '外国语学院', '商学院'];
const MAJORS = ['网络与新媒体', '数字媒体艺术', '视觉传达设计', '人工智能', '广告学'];
const MESSAGES = [
  '愿每一个还不成熟的想法，都有机会被看见。',
  '把今天的好奇，变成明天的作品。',
  '愿我们始终保留重新想象世界的勇气。',
  '让技术有温度，让表达被听见。',
  '灵感不会消失，它只是等待一次相遇。',
];

function hash(text) {
  let value = 2166136261;
  for (const char of text) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function coordinates(seed) {
  const angle = ((seed % 1000) / 1000) * Math.PI * 2;
  const radius = 16 + ((seed >>> 10) % 33);
  return {
    x: Math.round((50 + Math.cos(angle) * radius) * 10) / 10,
    y: Math.round((50 + Math.sin(angle) * radius * .62) * 10) / 10,
  };
}

export function createDemoPoints() {
  return Array.from({ length: 30 }, (_, index) => {
    const number = String(797 + index).padStart(4, '0');
    const point = coordinates(hash(`demo-${number}`));
    return {
      id: `demo-${number}`,
      number,
      name: ['林屿', '周晴', '陈墨', '许言', '苏禾'][index % 5] + (index > 4 ? String(Math.floor(index / 5) + 1) : ''),
      college: COLLEGES[index % COLLEGES.length],
      major: MAJORS[index % MAJORS.length],
      message: MESSAGES[index % MESSAGES.length],
      ...point,
      mine: false,
    };
  });
}

export function validateLightProfile(profile) {
  if (!profile.name?.trim()) return '请填写真实姓名';
  if (!profile.college?.trim()) return '请选择学院';
  if (!profile.major?.trim()) return '请填写专业';
  if (!profile.message?.trim()) return '请留下一句话';
  if ([...profile.message.trim()].length > 40) return '留言不能超过 40 字';
  return null;
}

export function createLightPoint(profile, currentCount = 30) {
  const clean = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, String(value).trim()]));
  const number = String(797 + currentCount).padStart(4, '0');
  return {
    id: `mine-${Date.now()}-${number}`,
    number,
    ...clean,
    ...coordinates(hash(`${clean.name}-${number}`)),
    mine: true,
    createdAt: new Date().toISOString(),
  };
}

export function saveLightPoints(storage, points) {
  storage.setItem(STORAGE_KEY, JSON.stringify(points));
  return points;
}

export function loadLightPoints(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) && parsed.length ? parsed : createDemoPoints();
  } catch {
    return createDemoPoints();
  }
}

export function resetLightPoints(storage) {
  const defaults = createDemoPoints();
  saveLightPoints(storage, defaults);
  return defaults;
}
