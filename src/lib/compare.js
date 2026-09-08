// Forgiving comparison for typed quiz answers.
//
// Levels, in order:
//   1. exact after lower-case + trim + collapsed spaces   -> correct
//   2. equal after folding ä/ö/ü/ß (and ae/oe/ue) to ascii -> correct, but flagged
//   3. otherwise                                          -> wrong
//
// Returns { correct, exact, notes: string[] }.

export function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/…|\.\.\./g, ' ') // "stehe … auf" and "stehe auf" are the same answer
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '');
}

export function fold(s) {
  return normalize(s)
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u');
}

/**
 * @param {string} input          what the user typed
 * @param {{text: string, note: string|null}[]} candidates acceptable answers
 */
export function compareTyped(input, candidates) {
  const n = normalize(input);
  if (!n) return { correct: false, exact: false, notes: [] };

  for (const c of candidates) {
    if (normalize(c.text) === n) {
      return { correct: true, exact: true, notes: c.note ? [c.note] : [] };
    }
  }
  const f = fold(input);
  for (const c of candidates) {
    if (fold(c.text) === f) {
      const notes = [`Spelling: the correct form is "${c.text}" (umlaut or ß differs)`];
      if (c.note) notes.push(c.note);
      return { correct: true, exact: false, notes };
    }
  }
  return { correct: false, exact: false, notes: [] };
}

export function compareChoice(input, expected) {
  const ok = normalize(input) === normalize(expected);
  return { correct: ok, exact: ok, notes: [] };
}
