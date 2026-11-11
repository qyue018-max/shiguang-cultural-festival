const ALLOWED = {
  opening: ['wormhole'], wormhole: ['welcome'], welcome: ['questions'],
  questions: ['light-game'], 'light-game': ['generating'], generating: ['planet-result'],
  'planet-result': ['privacy'], privacy: ['galaxy'], galaxy: ['planet-detail', 'keepsake'],
  'planet-detail': ['galaxy', 'keepsake'], keepsake: ['galaxy'],
};

export function createAppFlow() {
  let state = 'opening';
  let data = { answers: [], stats: null, planet: null, publicProfile: null, selectedPlanetId: null };
  const move = (next) => {
    if (!ALLOWED[state]?.includes(next)) throw new Error(`不能从 ${state} 进入 ${next}`);
    state = next;
    return state;
  };
  return {
    getState: () => state,
    getData: () => ({ ...data, answers: [...data.answers] }),
    startWormhole: () => move('wormhole'),
    finishWormhole: () => move('welcome'),
    startQuestions: () => move('questions'),
    setAnswers(answers) { data.answers = Array.isArray(answers) ? answers.map(String) : []; },
    startGame() {
      if (data.answers.length !== 3 || data.answers.some((answer) => !answer.trim())) throw new Error('请先完成三个问题');
      return move('light-game');
    },
    finishGame(stats) { data.stats = stats; return move('generating'); },
    finishGenerating(planet) { data.planet = planet; return move('planet-result'); },
    openPrivacy: () => move('privacy'),
    enterGalaxy(publicProfile) { data.publicProfile = publicProfile; return move('galaxy'); },
    showDetail(id) { data.selectedPlanetId = id; return move('planet-detail'); },
    showKeepsake() { return move('keepsake'); },
    backToGalaxy() { data.selectedPlanetId = null; return move('galaxy'); },
    reset() { state = 'opening'; data = { answers: [], stats: null, planet: null, publicProfile: null, selectedPlanetId: null }; return state; },
  };
}
