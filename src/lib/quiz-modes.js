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

// ---------------------------------------------------------------------------
// Derived question sets (built once by the quiz page and passed in ctx)
// ---------------------------------------------------------------------------
export const PRONOUNS = [
  { key: 'ich', de: 'ich', en: 'I', ending: '-e' },
  { key: 'du', de: 'du', en: 'you', ending: '-st' },
  { key: 'er', de: 'er / sie / es', en: 'he / she / it', ending: '-t' },
  { key: 'wir', de: 'wir', en: 'we', ending: '-en' },
  { key: 'ihr', de: 'ihr', en: 'you all', ending: '-t' },
  { key: 'sie', de: 'sie / Sie', en: 'they / you (formal)', ending: '-en' },
];
const ENDINGS = ['-e', '-st', '-t', '-en'];
const PERSONAL = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'Sie']);

// A weak verb whose stem takes the endings with no spelling change.
function regularStem(e) {
  if (!e.verb || e.verb.strength !== 'weak' || e.verb.separable) return null;
  if (!/en$/.test(e.german) || e.german.includes(' ')) return null;
  const stem = e.german.slice(0, -2);
  if (/(t|d|s|ß|z|x|el|er|chn|ffn|gn|tm)$/.test(stem)) return null; // arbeiten, reisen, handeln … need extra rules
  return stem;
}
function presentOf(e) {
  if (e.verb?.present && PRONOUNS.every((p) => e.verb.present[p.key])) return e.verb.present;
  const stem = regularStem(e);
  if (!stem) return null;
  return { ich: stem + 'e', du: stem + 'st', er: stem + 't', wir: stem + 'en', ihr: stem + 't', sie: stem + 'en' };
}
/** verb × pronoun items for the Conjugate mode */
export function conjugationItems(vocab) {
  const out = [];
  for (const e of vocab) {
    if (e.pos !== 'verb') continue;
    const forms = presentOf(e);
    if (!forms) continue;
    for (const p of PRONOUNS) {
      out.push({
        id: `${e.id}:${p.key}`, lesson: e.lesson, tags: e.tags,
        verb: e, pronoun: p, form: forms[p.key], forms,
      });
    }
  }
  return out;
}
/** one item per pronoun for the Endings mode */
export function endingItems() {
  return PRONOUNS.map((p) => ({ id: `ending:${p.key}`, lesson: 2, tags: ['essentials'], pronoun: p }));
}
const paradigm = (forms) => PRONOUNS.map((p) => `${p.de.split(' ')[0]} ${forms[p.key]}`).join(' · ');

export const modes = [
  // ---- Basics ---------------------------------------------------------------
  {
    id: 'pronouns',
    label: 'Pronouns',
    group: 'Basics',
    description: 'See the English pronoun, type the German: I → ich.',
    filter: (e) => e.pos === 'pronoun' && PERSONAL.has(e.german),
    prompt: (e) => e.english,
    answer: (e) => e.german,
    input: 'typed',
  },
  {
    id: 'endings',
    label: 'Endings',
    group: 'Basics',
    description: 'Which present-tense ending goes with this pronoun? ich → -e.',
    source: 'endings',
    filter: () => true,
    prompt: (it) => it.pronoun.de,
    answer: (it) => it.pronoun.ending,
    input: { type: 'choice', options: ENDINGS },
    reveal: (it) => `${it.pronoun.en} · kauf${it.pronoun.ending.slice(1)}`,
  },
  {
    id: 'conjugate',
    label: 'Conjugate',
    group: 'Basics',
    description: 'A regular verb and a person: type the form with its pronoun, e.g. "ich kaufe".',
    source: 'conjugation',
    filter: () => true,
    prompt: (it) => `${it.verb.german} (${it.verb.english})`,
    subprompt: (it) => it.pronoun.en,
    answer: (it) => `${it.pronoun.de.split(' ')[0]} ${it.form}`,
    input: 'typed',
    accept: (it) => {
      const subjects = it.pronoun.de.split(' / ');
      const out = subjects.map((sub) => ({ text: `${sub} ${it.form}`, note: null }));
      out.push({ text: it.form, note: `Say the pronoun too: ${subjects[0]} ${it.form}` });
      return out;
    },
    reveal: (it) => paradigm(it.forms),
  },

  {
    id: 'de-en',
    group: 'Vocabulary',
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
    group: 'Vocabulary',
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
    group: 'Grammar',
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
    group: 'Grammar',
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
    group: 'Grammar',
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
    group: 'Grammar',
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
    group: 'Worksheets',
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
    group: 'Worksheets',
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
    group: 'Worksheets',
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
