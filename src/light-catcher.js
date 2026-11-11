const COLORS = ['blue', 'violet', 'gold'];

export function createLightGameCore({ durationMs = 20000 } = {}) {
  const colors = { blue: 0, violet: 0, gold: 0 };
  let total = 0, combo = 0, bestCombo = 0, lastAt = null, speedSum = 0, distance = 0, finished = false;
  return {
    durationMs,
    collect(color, { speed = 0, distance: traveled = 0, at = Date.now() } = {}) {
      if (finished || !COLORS.includes(color)) return false;
      combo = lastAt !== null && at - lastAt <= 900 ? combo + 1 : 1;
      lastAt = at; bestCombo = Math.max(bestCombo, combo);
      colors[color] += 1; total += 1; speedSum += Number(speed) || 0; distance += Number(traveled) || 0;
      return true;
    },
    finish() {
      finished = true;
      return { total, colors: { ...colors }, bestCombo, averageSpeed: total ? speedSum / total : 0, distance };
    },
  };
}

export function seededRandom(seed = 1) {
  let value = seed >>> 0 || 1;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
}
