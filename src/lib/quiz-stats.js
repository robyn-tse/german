// Per-word attempt/error counts in localStorage. Per-device by design:
// laptop and phone keep separate numbers, and the UI says so.
const KEY = 'german-quiz-stats-v1';

export function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function saveStats(stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* private mode / quota: stats just don't persist */
  }
}

export function record(stats, id, correct) {
  const s = stats[id] || { attempts: 0, errors: 0 };
  s.attempts += 1;
  if (!correct) s.errors += 1;
  s.last = Date.now();
  stats[id] = s;
  saveStats(stats);
  return s;
}

export function resetStats() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
