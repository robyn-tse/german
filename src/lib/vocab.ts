import type { VocabEntry } from '../content.config';

export const ARTICLES = ['der', 'die', 'das'] as const;

/** "die Zeitung" -> { article: "die", word: "Zeitung" }; verbs pass through. */
export function splitArticle(german: string): { article: string | null; word: string } {
  const m = german.match(/^(der|die|das) (.+)$/);
  return m ? { article: m[1], word: m[2] } : { article: null, word: german };
}

/** Entries missing data we expect to fill in later get a subtle marker. */
export function isIncomplete(e: VocabEntry): boolean {
  if (e.pos === 'noun' && !e.plural) return true;
  if ((e.pos === 'noun' || e.pos === 'verb') && !e.example_de) return true;
  return false;
}

export function missingFields(e: VocabEntry): string[] {
  const out: string[] = [];
  if (e.pos === 'noun' && !e.plural) out.push('plural');
  if ((e.pos === 'noun' || e.pos === 'verb') && !e.example_de) out.push('example');
  return out;
}

export const POS_LABEL: Record<string, string> = {
  noun: 'Nomen',
  verb: 'Verb',
  adjective: 'Adjektiv',
  prefix: 'Präfix',
  phrase: 'Phrase',
  adverb: 'Adverb',
  preposition: 'Präposition',
  conjunction: 'Konjunktion',
  pronoun: 'Pronomen',
  number: 'Zahl',
  other: 'Sonstiges',
};
export const POS_ORDER = ['verb', 'noun', 'adjective', 'adverb', 'phrase', 'preposition', 'conjunction', 'pronoun', 'number', 'prefix', 'other'];

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
