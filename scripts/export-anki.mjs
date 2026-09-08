#!/usr/bin/env node
// Emits the Anki vocab TSV for one lesson from src/data/vocab.json.
//
//   node scripts/export-anki.mjs 2      -> exports/lesson-02-verben.tsv, lesson-02-nomen.tsv, ...
//                                          (one file per part of speech present in that lesson)
//
// Format: Anki header syntax, columns Front / Back / Tags, tags namespaced
// lessonN::category. Prefix entries (pos "prefix") are skipped here because
// they are exported as rule cards in the hand-written lesson-NN-regeln.tsv.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lesson = Number(process.argv[2]);
if (!Number.isInteger(lesson) || lesson < 1) {
  console.error('usage: node scripts/export-anki.mjs <lesson-number>');
  process.exit(1);
}

const CATEGORY = {
  noun: 'nomen', verb: 'verben', adjective: 'adjektive', phrase: 'phrasen', adverb: 'adverbien',
  preposition: 'praepositionen', conjunction: 'konjunktionen', pronoun: 'pronomen', number: 'zahlen', other: 'sonstiges',
};
const TAG_PASSTHROUGH = new Set(['trennbar', 'untrennbar', 'genus', 'merken']);

const vocab = JSON.parse(readFileSync(path.join(root, 'src/data/vocab.json'), 'utf8'));
const byCategory = new Map();
for (const e of vocab) {
  if (e.lesson !== lesson || e.pos === 'prefix') continue;
  const category = CATEGORY[e.pos] ?? 'sonstiges';
  const tags = new Set([`lesson${lesson}::${category}`]);
  for (const t of e.tags ?? []) if (TAG_PASSTHROUGH.has(t)) tags.add(`lesson${lesson}::${t}`);
  const clean = (s) => String(s).replace(/[\t\n]+/g, ' ');
  if (!byCategory.has(category)) byCategory.set(category, []);
  byCategory.get(category).push([clean(e.german), clean(e.english), [...tags].join(' ')].join('\t'));
}

if (byCategory.size === 0) {
  console.error(`no vocab entries found for lesson ${lesson}`);
  process.exit(1);
}

const header = ['#separator:tab', '#html:false', '#columns:Front\tBack\tTags'];
const nn = String(lesson).padStart(2, '0');
mkdirSync(path.join(root, 'exports'), { recursive: true });
for (const [category, rows] of byCategory) {
  const out = path.join(root, 'exports', `lesson-${nn}-${category}.tsv`);
  writeFileSync(out, [...header, ...rows].join('\n') + '\n');
  console.log(`wrote ${rows.length} cards to ${path.relative(root, out)}`);
}
