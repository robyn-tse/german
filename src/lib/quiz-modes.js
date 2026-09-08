// ---------------------------------------------------------------------------
// Quiz mode registry.
//
// Every mode is the same four decisions:
//   filter  – which entries qualify
//   prompt  – what the entry shows
//   answer  – what the response is checked against (display form)
//   input   – 'typed', or { type: 'choice', options: [...] }
//
// Optional:
//   source     – 'vocab' (default) or 'exercises' (src/data/exercises.json)
//   subprompt  – secondary line under the prompt (e.g. the English sentence)
//   accept     – extra acceptable typed answers, each { text, note }; `note`
//                is shown when that alternative matched
//   reveal     – extra text shown in the feedback regardless of result
//
// Adding a mode is a new object in this array; nothing else changes.
// ---------------------------------------------------------------------------

const hasPrefix = (e) => e.tags.includes('trennbar') || e.tags.includes('untrennbar');
const stripArticle = (german) => german.replace(/^(der|die|das) /, '');

// Every mode function receives (entry, ctx) where ctx = { vocab, exercises, rules }.
// Longest matching suffix wins (-keit before -t, -ion before -n).
// strict: skip rules marked weak and require a real stem in front of the ending,
// so "Ort" is not treated as an -t word or "Zoo" as an -o word.
export function ruleFor(word, rules, strict = false) {
  const w = word.toLowerCase();
  let best = null;
  for (const r of rules) {
    if (strict && r.weak) continue;
    const s = r.suffix.toLowerCase();
    const isPrefix = s.endsWith('-');
    const hit = isPrefix ? w.startsWith(s.slice(0, -1)) : w.endsWith(s.slice(1));
    if (!hit) continue;
    if (strict && !isPrefix && w.length < s.length - 1 + 3) continue;
    if (!best || s.length > best.suffix.length) best = r;
  }
  return best;
}
const ARTICLE_NOTE = {
  der: 'masculine', die: 'feminine', das: 'neuter',
  ein: 'ein: masculine or neuter (nominative), neuter (accusative)',
  eine: 'eine: feminine',
  einen: 'einen: masculine in the accusative (the object of the sentence)',
  einer: 'einer: feminine in the dative (after "in" with no movement)',
};

export const modes = [
  {
    id: 'de-en',
    label: 'DE → EN',
    description: 'See the German word, type the English.',
    // Prefixes have approximate glosses, not translatable answers, so they are
    // left out of the typed translation modes.
    filter: (e) => e.pos !== 'prefix',
    prompt: (e) => e.german,
    answer: (e) => e.english,
    input: 'typed',
    accept: (e) =>
      e.english.split(' / ').flatMap((alt) => {
        const out = [{ text: alt, note: null }];
        if (/^to /.test(alt)) out.push({ text: alt.slice(3), note: `Full gloss: "${alt}"` });
        if (/^the /.test(alt)) out.push({ text: alt.slice(4), note: null });
        return out;
      }),
    reveal: (e) => (e.example_de ? e.example_de : null),
  },
  {
    id: 'en-de',
    label: 'EN → DE',
    description: 'See the English, type the German. Nouns: article optional, but you will be shown it.',
    filter: (e) => e.pos !== 'prefix',
    prompt: (e) => e.english,
    answer: (e) => e.german,
    input: 'typed',
    accept: (e) => {
      const out = [{ text: e.german, note: null }];
      if (e.pos === 'noun') {
        out.push({ text: stripArticle(e.german), note: `Answered without the article — it's ${e.german}` });
      }
      return out;
    },
    reveal: (e) => (e.pos === 'noun' ? `Article: ${e.german}` : null),
  },
  {
    id: 'gender-rule',
    label: 'Gender rule',
    description: 'A noun ends in … — which article? The rules from the article handout.',
    source: 'rules',
    filter: () => true,
    prompt: (r) => r.suffix,
    answer: (r) => r.gender,
    input: { type: 'choice', options: ['der', 'die', 'das'] },
    reveal: (r) => `${r.examples.join(', ')}${r.notes ? ' · ' + r.notes : ''}`,
  },
  {
    id: 'gender',
    label: 'Gender',
    description: 'Apply the rules: pick der, die or das for a noun whose ending has a rule.',
    // Only nouns a suffix rule applies to, so this drills the rules rather than
    // brute memorisation. Exceptions to a rule are still asked (and explained).
    filter: (e, ctx) => e.pos === 'noun' && !!e.gender && !!ruleFor(stripArticle(e.german), ctx.rules, true),
    prompt: (e) => stripArticle(e.german),
    answer: (e) => e.gender,
    input: { type: 'choice', options: ['der', 'die', 'das'] },
    reveal: (e, ctx) => {
      const r = ruleFor(stripArticle(e.german), ctx.rules, true);
      if (!r) return null;
      return r.gender === e.gender
        ? `Rule: ${r.suffix} → ${r.gender}`
        : `Exception! ${r.suffix} is usually ${r.gender}, but it's ${e.german}`;
    },
  },
  {
    id: 'prefix',
    label: 'Prefix',
    description: 'Is this verb separable or inseparable?',
    filter: (e) => e.pos === 'verb' && !!e.verb && hasPrefix(e),
    prompt: (e) => e.german,
    answer: (e) => (e.verb.separable ? 'separable' : 'inseparable'),
    input: { type: 'choice', options: ['separable', 'inseparable'] },
    reveal: (e) => e.example_de,
  },
  {
    id: 'partizip',
    label: 'Partizip II',
    description: 'Type the past participle. Separable: ge- goes after the prefix; inseparable: no ge-.',
    filter: (e) => e.pos === 'verb' && !!e.verb?.partizip_ii,
    prompt: (e) => e.german,
    answer: (e) => e.verb.partizip_ii,
    input: 'typed',
    reveal: (e) => `Perfekt with ${e.verb.aux}: ich ${e.verb.aux === 'sein' ? 'bin' : 'habe'} ${e.verb.partizip_ii}`,
  },
  {
    id: 'satz-trennbar',
    label: 'Verb im Satz',
    description: 'Fill the gap(s) with the verb in brackets. Two gaps: type both parts, e.g. "stehe auf".',
    source: 'exercises',
    filter: (e) => e.set === 'trennbar-praesens' || e.set === 'trennbar-modal' || e.set === 'gemischt',
    prompt: (e) => `${e.prompt_de}  (${e.hint})`,
    subprompt: (e) => e.en,
    answer: (e) => e.answer.replace(' ', ' … '),
    input: 'typed',
    accept: (e) => [{ text: e.answer, note: null }],
    reveal: (e) => e.full_de,
  },
  {
    id: 'artikel-satz',
    label: 'der / die / das im Satz',
    description: 'Pick the definite article. Plural nouns take die.',
    source: 'exercises',
    filter: (e) => e.set === 'artikel-bestimmt',
    prompt: (e) => e.prompt_de,
    answer: (e) => e.answer,
    input: { type: 'choice', options: ['der', 'die', 'das'] },
    reveal: (e) => `${e.full_de}${e.tags.includes('plural') ? ' · plural → die' : ''}`,
  },
  {
    id: 'unbestimmt',
    label: 'ein / eine / einen',
    description: 'Pick the indefinite article. Watch for masculine objects (einen).',
    source: 'exercises',
    filter: (e) => e.set === 'artikel-unbestimmt',
    prompt: (e) => e.prompt_de,
    answer: (e) => e.answer,
    input: { type: 'choice', options: ['ein', 'eine', 'einen', 'einer'] },
    reveal: (e) => `${e.full_de} · ${ARTICLE_NOTE[e.answer]}`,
  },

  // --- Sketches for later modes; no engine changes needed --------------------
  // {
  //   id: 'plural', label: 'Plural',
  //   filter: (e) => e.pos === 'noun' && !!e.plural,
  //   prompt: (e) => e.german, answer: (e) => e.plural, input: 'typed',
  //   accept: (e) => [{ text: e.plural, note: null }, { text: `die ${e.plural}`, note: null }],
  // },
  // {
  //   id: 'present-du', label: 'Present (du)',
  //   filter: (e) => !!e.verb?.present?.du,
  //   prompt: (e) => `du … (${e.german})`, answer: (e) => e.verb.present.du, input: 'typed',
  // },
  // {
  //   id: 'case', label: 'Case in sentence',
  //   source: 'exercises', filter: (e) => e.set === 'kasus',
  //   prompt: (e) => e.prompt_de, answer: (e) => e.answer,
  //   input: { type: 'choice', options: ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv'] },
  // },
];

export function getMode(id) {
  return modes.find((m) => m.id === id);
}
