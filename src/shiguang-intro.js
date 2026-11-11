export function createIntroFlow({ durationMs = 3000 } = {}) {
  let state = 'opening';

  return {
    getState() {
      return state;
    },
    start() {
      if (state === 'opening') state = 'transitioning';
      return { state, durationMs };
    },
    finish() {
      state = 'galaxy';
      return { state };
    },
    skip() {
      state = 'galaxy';
      return { state };
    },
  };
}
