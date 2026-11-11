const KEY = 'shiguang-galaxy:v1';

export function createPlanetStore(storage = globalThis.localStorage) {
  return {
    save(value) { try { storage?.setItem(KEY, JSON.stringify({ version: 1, value })); return true; } catch { return false; } },
    load() {
      try { const parsed = JSON.parse(storage?.getItem(KEY)); return parsed?.version === 1 && parsed.value ? parsed.value : null; }
      catch { return null; }
    },
    clear() { try { storage?.removeItem(KEY); return true; } catch { return false; } },
  };
}
