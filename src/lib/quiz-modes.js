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

// clear accusative verbs from the vocab, used as the contrast set in 'Dativ or Akkusativ?'
const ACC_VERBS = new Set(['sehen', 'essen', 'trinken', 'lesen', 'finden', 'suchen', 'brauchen', 'besuchen', 'lieben', 'haben', 'machen', 'hören', 'tragen', 'öffnen', 'bestellen', 'verstehen', 'vergessen', 'verkaufen', 'bezahlen', 'treffen', 'nehmen', 'lernen', 'spielen', 'benutzen', 'fragen', 'kennen', 'wissen', 'trinken']);
/** For "Sie ___ …" sentences: the other reading's verb form (singular ↔ plural), or null. */
function sieAlternative(e) {
  if (!e.hint || !/^Sie\s/.test(e.prompt_de)) return null;
  if (e.answer === e.hint) return null;         // modal-verb sentence: the gap is the infinitive, no other reading
  const parts = e.answer.split(' ');           // "macht zu" → ["macht", "zu"]
  const prefix = parts[1] ?? '';
  const base = prefix && e.hint.startsWith(prefix) ? e.hint.slice(prefix.length) : e.hint; // zumachen → machen
  const stem = base.replace(/e?n$/, '');       // machen → mach, sammeln → sammel, tun → tu
  let alt;
  if (/en$/.test(parts[0]) || parts[0] === base) alt = /(t|d|chn|ffn|gn|tm)$/.test(stem) ? stem + 'et' : stem + 't'; // plural → singular
  else alt = base;                             // singular → plural (the infinitive form)
  if (alt === parts[0]) return null;
  return [alt, ...parts.slice(1)].join(' ');
}
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
// Typed article gaps: accept the article alone or with its noun ("dem" / "dem Mann");
// "no article" (plural indefinite) is typed as a dash.
function articleAccept(e) {
  const noun = (e.prompt_de.match(/___\s*(?:\([^)]*\)\s*)?([^\s.,?!]+)/) || [])[1]; // the noun right after the gap
  if (e.answer === '–') return ['–', '-', '—', 'kein artikel', 'nichts', 'x'].map((t) => ({ text: t, note: null }));
  const out = [{ text: e.answer, note: null }];
  if (noun) out.push({ text: `${e.answer} ${noun}`, note: null });
  if (e.also) out.push({ text: e.also, note: e.note }, { text: `${e.also} ${noun ?? ''}`.trim(), note: e.note });
  return out;
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
  { key: 'er', de: 'er', en: 'he', ending: '-t' },
  { key: 'er', de: 'sie', en: 'she', ending: '-t' },
  { key: 'er', de: 'es', en: 'it', ending: '-t' },
  { key: 'wir', de: 'wir', en: 'we', ending: '-en' },
  { key: 'ihr', de: 'ihr', en: 'you all', ending: '-t' },
  { key: 'sie', de: 'sie', en: 'they', ending: '-en' },
  { key: 'sie', de: 'Sie', en: 'you (formal)', ending: '-en' },
];
const FORM_KEYS = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];
const ENDINGS = ['-e', '-st', '-t', '-en'];

// A weak verb whose stem takes the endings with no spelling change.
function regularStem(e) {
  if (!e.verb || e.verb.strength !== 'weak' || e.verb.separable) return null;
  if (!/en$/.test(e.german) || e.german.includes(' ')) return null;
  const stem = e.german.slice(0, -2);
  if (/(t|d|s|ß|z|x|el|er|chn|ffn|gn|tm)$/.test(stem)) return null; // arbeiten, reisen, handeln … need extra rules
  return stem;
}
function presentOf(e) {
  if (e.verb?.present && FORM_KEYS.every((k) => e.verb.present[k])) return e.verb.present;
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
        id: `${e.id}:${p.de}`, lesson: e.lesson, tags: e.tags,
        verb: e, pronoun: p, form: forms[p.key], forms,
      });
    }
  }
  return out;
}
/** the article tables from lesson 3: one question per case x gender x article type */
const CASES = ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv'];
const CASE_TABLE = {
  definite:   { Nominativ: ['der','die','das','die'], Akkusativ: ['den','die','das','die'], Dativ: ['dem','der','dem','den'], Genitiv: ['des','der','des','der'] },
  indefinite: { Nominativ: ['ein','eine','ein',null], Akkusativ: ['einen','eine','ein',null], Dativ: ['einem','einer','einem',null], Genitiv: ['eines','einer','eines',null] },
  kein:       { Nominativ: ['kein','keine','kein','keine'], Akkusativ: ['keinen','keine','kein','keine'], Dativ: ['keinem','keiner','keinem','keinen'], Genitiv: ['keines','keiner','keines','keiner'] },
};
const CASE_NOUNS = [
  { word: 'Mann', gen: 'Mannes', label: 'masculine' }, { word: 'Frau', gen: 'Frau', label: 'feminine' },
  { word: 'Kind', gen: 'Kindes', label: 'neuter' }, { word: 'Familien', gen: 'Familien', label: 'plural' },
];
export function caseItems() {
  const items = [];
  for (const [type, table] of Object.entries(CASE_TABLE)) {
    CASE_NOUNS.forEach((n, gi) => {
      const nom = table.Nominativ[gi];
      if (nom === null) return;
      for (const c of CASES) {
        const art = table[c][gi];
        const noun = c === 'Genitiv' ? n.gen : n.word;
        items.push({
          id: `case:${type}:${c}:${n.word}`, lesson: 3, tags: ['kasus', type], case: c, type, gender: n.label,
          base: `${nom} ${n.word}`, article: art, phrase: `${art} ${noun}`,
          row: CASE_NOUNS.map((m, i) => `${table[c][i]} ${c === 'Genitiv' ? m.gen : m.word}`).join(' · '),
        });
      }
    });
  }
  return items;
}

/** one question per English personal pronoun (she and they are separate questions) */
export function pronounItems() {
  const pairs = [
    ['I', 'ich'], ['you', 'du'], ['he', 'er'], ['she', 'sie'], ['it', 'es'],
    ['we', 'wir'], ['you all', 'ihr'], ['they', 'sie'], ['you (formal)', 'Sie'],
  ];
  return pairs.map(([en, de]) => ({ id: `pronoun:${en.replace(/\W+/g, '-')}`, lesson: 2, tags: ['essentials'], en, de }));
}
/** one item per pronoun for the Endings mode */
export function endingItems() {
  return PRONOUNS.map((p) => ({ id: `ending:${p.de}`, lesson: 2, tags: ['essentials'], pronoun: p }));
}
const paradigm = (forms) => `ich ${forms.ich} · du ${forms.du} · er/sie/es ${forms.er} · wir ${forms.wir} · ihr ${forms.ihr} · sie/Sie ${forms.sie}`;

export const modes = [
  // ---- Basics ---------------------------------------------------------------
  {
    id: 'pronouns',
    label: 'Pronouns',
    group: 'Basics',
    description: 'See the English pronoun, type the German: I → ich.',
    source: 'pronouns',
    filter: () => true,
    prompt: (it) => it.en,
    answer: (it) => it.de,
    input: 'typed',
    reveal: (it) => (it.de === 'sie' ? 'sie = she and they; Sie (capital) = you, formal' : null),
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
    answer: (it) => `${it.pronoun.de} ${it.form}`,
    input: 'typed',
    accept: (it) => [
      { text: `${it.pronoun.de} ${it.form}`, note: null },
      { text: it.form, note: `Say the pronoun too: ${it.pronoun.de} ${it.form}` },
    ],
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
    id: 'satz-trennbar',
    group: 'Worksheets',
    label: 'Verb im Satz',
    description: 'Fill the gap(s) with the verb in brackets. Two gaps: type both parts, e.g. "stehe auf".',
    source: 'exercises',
    filter: (e) => ['trennbar-praesens', 'trennbar-modal', 'gemischt', 'schwach-praesens'].includes(e.set),
    prompt: (e) => `${e.prompt_de}  (${e.hint})`,
    subprompt: (e) => e.en,
    answer: (e) => e.answer.replace(' ', ' … '),
    input: 'typed',
    accept: (e) => {
      const out = [{ text: e.answer, note: null }];
      // A sentence-initial "Sie" is ambiguous (she / they / formal you); the German alone allows
      // both the singular and the plural form, so accept the other one and point to the English.
      const alt = sieAlternative(e);
      if (alt) out.push({ text: alt, note: `"Sie" can be she or they / formal you. Here the English says "${e.en}" → ${e.answer}.` });
      return out;
    },
    reveal: (e) => e.full_de,
  },
  {
    id: 'artikel-satz',
    group: 'Worksheets',
    label: 'der / die / das im Satz',
    description: 'Type the definite article (der, die, das; plural die).',
    source: 'exercises',
    filter: (e) => e.set === 'artikel-bestimmt',
    prompt: (e) => e.prompt_de,
    answer: (e) => e.answer,
    input: 'typed',
    accept: articleAccept,
    reveal: (e) => `${e.full_de}${e.tags.includes('plural') ? ' · plural → die' : ''}`,
  },
  {
    id: 'unbestimmt',
    group: 'Worksheets',
    label: 'ein / eine / einen',
    description: 'Type the indefinite article (ein, eine, einen, einer).',
    source: 'exercises',
    filter: (e) => e.set === 'artikel-unbestimmt',
    prompt: (e) => e.prompt_de,
    answer: (e) => e.answer,
    input: 'typed',
    accept: articleAccept,
    reveal: (e) => `${e.full_de} · ${ARTICLE_NOTE[e.answer]}`,
  },

  {
    id: 'dativverben',
    group: 'Grammar',
    label: 'Dative verbs',
    description: "Markus's list: see the English, type the verb. to forgive → verzeihen.",
    filter: (e) => e.pos === 'verb' && e.tags.includes('dativverb'),
    prompt: (e) => e.english,
    answer: (e) => e.german,
    input: 'typed',
    reveal: (e) => e.example_de,
  },
  {
    id: 'dativ-oder-akk',
    group: 'Grammar',
    label: 'Dativ or Akkusativ?',
    description: 'Does this verb take the dative (on the list) or the accusative (everything else)?',
    filter: (e) => e.pos === 'verb' && (e.tags.includes('dativverb') || ACC_VERBS.has(e.german)),
    prompt: (e) => `${e.german} (${e.english})`,
    answer: (e) => (e.tags.includes('dativverb') ? 'Dativ' : 'Akkusativ'),
    input: { type: 'choice', options: ['Dativ', 'Akkusativ'] },
    reveal: (e) => (e.tags.includes('dativverb') ? e.example_de : 'Not on the dative list → Akkusativ'),
  },
  {
    id: 'kasus',
    group: 'Grammar',
    label: 'Cases',
    description: 'der Mann → Dativ? Type the article (or the whole phrase) for the case asked.',
    source: 'cases',
    filter: () => true,
    prompt: (it) => `${it.base} → ${it.case}`,
    subprompt: (it) => `${it.gender}, ${it.type === 'kein' ? 'kein' : it.type + ' article'}`,
    answer: (it) => it.phrase,
    input: 'typed',
    accept: (it) => [{ text: it.phrase, note: null }, { text: it.article, note: null }],
    reveal: (it) => `${it.case}: ${it.row}`,
  },
  {
    id: 'dativ',
    group: 'Worksheets',
    label: 'Dativ',
    description: 'Type the dative article: dem, der, dem, den (plural).',
    source: 'exercises',
    filter: (e) => e.set === 'l4-dativ' || e.set === 'l4-dativ-verben',
    prompt: (e) => e.prompt_de,
    subprompt: (e) => e.en,
    answer: (e) => e.answer,
    input: 'typed',
    accept: articleAccept,
    reveal: (e) => `${e.full_de}${e.note ? ' · ' + e.note : ''}`,
  },
  {
    id: 'akkusativ',
    group: 'Worksheets',
    label: 'Akkusativ',
    description: 'Type the accusative article: den, die, das.',
    source: 'exercises',
    filter: (e) => e.set === 'l4-akkusativ',
    prompt: (e) => e.prompt_de,
    subprompt: (e) => e.en,
    answer: (e) => e.answer,
    input: 'typed',
    accept: articleAccept,
    reveal: (e) => `${e.full_de}${e.note ? ' · ' + e.note : ''}`,
  },
  {
    id: 'akkusativ-unbestimmt',
    group: 'Worksheets',
    label: 'Akkusativ: einen / eine / ein',
    description: 'Type the indefinite article in the accusative: einen, eine, ein; a dash for no article.',
    source: 'exercises',
    filter: (e) => e.set === 'l4-akkusativ-2',
    prompt: (e) => e.prompt_de,
    subprompt: (e) => e.en,
    answer: (e) => e.answer,
    input: 'typed',
    accept: articleAccept,
    reveal: (e) => `${e.full_de}${e.note ? ' · ' + e.note : ''}`,
  },

  // --- Sketches for later modes; no engine changes needed --------------------
  //   {
  //     id: 'partizip',
  //     group: 'Grammar',
  //     label: 'Partizip II',
  //     description: 'Type the past participle. Separable: ge- goes after the prefix; inseparable: no ge-.',
  //     filter: (e) => e.pos === 'verb' && !!e.verb?.partizip_ii,
  //     prompt: (e) => e.german,
  //     answer: (e) => e.verb.partizip_ii,
  //     input: 'typed',
  //     reveal: (e) => `Perfekt with ${e.verb.aux}: ich ${e.verb.aux === 'sein' ? 'bin' : 'habe'} ${e.verb.partizip_ii}`,
  //   },
  // (Partizip II: re-enable when Perfekt is taught)
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
