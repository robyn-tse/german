import { getCollection } from 'astro:content';

// Homework questions for the Review page's practice boxes, grouped by section.
// Fetched once, the first time a box is opened, so the page itself stays light.
export const SECTION_SETS: Record<string, string[]> = {
  praesens: ['schwach-praesens'],
  artikel: ['artikel-bestimmt', 'artikel-unbestimmt'],
  faelle: ['l4-dativ', 'l4-akkusativ', 'l4-akkusativ-2', 'l5-genitiv', 'mixed-genitiv', 'mixed-dativ', 'mixed-akkusativ'],
  'verben-kasus': ['l4-dativ-verben'],
  praepositionen: ['l5-wechsel', 'l5-praep', 'mixed-praep'],
  personalpronomen: ['r-personalpronomen', 'mixed-personal'],
  possessivpronomen: ['r-possessiv', 'mixed-possessiv'],
  reflexiv: ['r-reflexiv'],
  praefixe: ['trennbar-praesens', 'trennbar-modal', 'gemischt'],
  perfekt: ['perfekt-hilfsverb', 'perfekt-partizip', 'perfekt-praefix', 'perfekt-1', 'perfekt-2', 'perfekt-3', 'perfekt-4'],
};

export async function GET() {
  const all = [
    ...(await getCollection('exercises')).map((e) => e.data),
    ...(await getCollection('reviewExercises')).map((e) => e.data),
  ];
  const pick = ({ id, prompt_de, hint, hint_en, answer, also, full_de, en, note, gloss }: (typeof all)[number]) =>
    ({ id, prompt_de, hint, hint_en, answer, also, full_de, en, note, gloss });
  const pools: Record<string, ReturnType<typeof pick>[]> = {};
  for (const [section, sets] of Object.entries(SECTION_SETS)) {
    pools[section] = all.filter((e) => sets.includes(e.set) && e.gloss).map(pick);
  }
  return new Response(JSON.stringify(pools), { headers: { 'Content-Type': 'application/json' } });
}
