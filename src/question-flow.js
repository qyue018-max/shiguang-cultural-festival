export const QUESTIONS = [
  { title: '未来的你，正在做什么？', placeholder: '写下你的想象…', suggestions: ['探索未知', '创造新事物', '帮助更多人'] },
  { title: '你最想拥有哪种能力？', placeholder: '例如：创造力、勇气、共情力…', suggestions: ['创造力', '洞察力', '行动力'] },
  { title: '你想给未来的自己留下一句话吗？', placeholder: '写给未来的你…', suggestions: ['保持好奇', '勇敢出发', '温柔坚定'] },
];

export function normalizeAnswer(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 180);
}

export function createQuestionFlow(initial = []) {
  let index = 0;
  const answers = [0, 1, 2].map((i) => normalizeAnswer(initial[i]));
  return {
    getIndex: () => index,
    getQuestion: () => QUESTIONS[index],
    answer(value) { answers[index] = normalizeAnswer(value); return answers[index]; },
    next() {
      if (!answers[index]) throw new Error('请填写答案');
      if (index < QUESTIONS.length - 1) index += 1;
      return index;
    },
    previous() { if (index > 0) index -= 1; return index; },
    isComplete: () => answers.every(Boolean),
    getAnswers: () => [...answers],
  };
}
