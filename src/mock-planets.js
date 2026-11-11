const NAMES = ['梦想星', '回忆星', '成长星', '陪伴星', '学习星', '旅行星', '未来星', '勇气星', '好奇星', '创造星'];
const IDENTITIES = ['未来建筑师', '深海探索者', '人工智能研究者', '青年艺术家', '生态守护者', '教育创新者'];
const WORDS = ['勇气', '好奇', '创造', '自由', '成长', '共鸣', '探索', '温柔'];
const COLORS = ['#55c7ff', '#a56eff', '#ffc76b'];
function randFactory(seed = 90210) { let s = seed; return () => { s = Math.imul(s, 1664525) + 1013904223 | 0; return (s >>> 0) / 4294967296; }; }

export function generateMockPlanets(count = 120) {
  const rand = randFactory();
  return Array.from({ length: count }, (_, index) => {
    const angle = index * 2.399963 + rand() * 0.2;
    const radius = 10 + Math.sqrt((index + 1) / count) * 42;
    return {
      id: `mock-${index + 1}`,
      nickname: `拾光者 ${String(index + 1).padStart(3, '0')}`,
      planetName: NAMES[index % NAMES.length],
      futureIdentity: IDENTITIES[index % IDENTITIES.length],
      keywords: [WORDS[index % WORDS.length], WORDS[(index + 3) % WORDS.length], WORDS[(index + 5) % WORDS.length]],
      message: ['愿未来仍敢走向未知', '愿每一次选择都靠近热爱', '愿好奇心永远明亮'][index % 3],
      color: COLORS[index % COLORS.length], angle, radius,
    };
  });
}
