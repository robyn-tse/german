// ---------------------------------------------------------------------------
// Quiz mode registry.
//
// Every mode is the same four decisions:
//   filter  – which vocab entries qualify
//   prompt  – what the entry shows
//   answer  – what the response is checked against
//   input   – 'typed', or { type: 'choice', options: [...] }
//
// Optional:
//   accept(entry) – extra acceptable typed answers, each { text, note }.
//                   `note` is shown in the feedback when that alternative
//                   matched (e.g. "answered without the article").
//   reveal(entry) – extra text to show in the feedback regardless of result
//                   (e.g. the article for EN→DE nouns, or the example).
//
// Adding a mode is a new object in this array — nothing else changes.
// Sketches for later modes are at the bottom of the file.
// ---------------------------------------------------------------------------

const hasPrefix = (e) => e.tags.includes('trennbar') || e.tags.includes('untrennbar');
const stripArticle = (german) => german.replace(/^(der|die|das) /, '');

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
    id: 'gender',
    label: 'Gender',
    description: 'Pick der, die or das for a noun.',
    filter: (e) => e.pos === 'noun' && !!e.gender,
    prompt: (e) => stripArticle(e.german),
    answer: (e) => e.gender,
    input: { type: 'choice', options: ['der', 'die', 'das'] },
    reveal: (e) => (e.notes && /suffix/i.test(e.notes) ? e.notes : null),
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

  // --- Design check: modes to add later, no engine changes needed ----------
  // {
  //   id: 'plural', label: 'Plural',
  //   filter: (e) => e.pos === 'noun' && !!e.plural,
  //   prompt: (e) => e.german, answer: (e) => e.plural, input: 'typed',
  //   accept: (e) => [{ text: e.plural, note: null }, { text: `die ${e.plural}`, note: null }],
  // },
  // {
  //   id: 'partizip', label: 'Partizip II',
  //   filter: (e) => !!e.verb?.partizip_ii,
  //   prompt: (e) => e.german, answer: (e) => e.verb.partizip_ii, input: 'typed',
  //   reveal: (e) => `Perfekt with ${e.verb.aux}`,
  // },
  // {
  //   id: 'present-du', label: 'Present (du)',
  //   filter: (e) => !!e.verb?.present?.du,
  //   prompt: (e) => `du … (${e.german})`, answer: (e) => e.verb.present.du, input: 'typed',
  // },
  // {
  //   id: 'case', label: 'Case in sentence',
  //   filter: (e) => e.pos === 'noun' && !!e.case_in_example,   // would need a new field
  //   prompt: (e) => e.example_de, answer: (e) => e.case_in_example,
  //   input: { type: 'choice', options: ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv'] },
  // },
];

export function getMode(id) {
  return modes.find((m) => m.id === id);
}
