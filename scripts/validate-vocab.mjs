#!/usr/bin/env node
// Enforces the vocab.json storage conventions documented in CLAUDE.md.
// Any violation fails the build (via scripts/astro-vocab-validator.mjs) and
// names the offending entry and rule. This script is the thing that remembers
// which convention we picked, so do not downgrade any of these to warnings.
//
// Usage: node scripts/validate-vocab.mjs            (exit 1 on any violation)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const VOCAB_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/data/vocab.json',
);

const ARTICLES = ['der', 'die', 'das'];

// Matches part-of-speech annotations we never want inside german/english:
// "(v.)", "(n.)", "(adj.)", "(verb)", "[verb]", "[noun]", trailing " v."...
const POS_ANNOTATION =
  /\((?:v|n|adj|adv|verb|noun|adjective|adverb)\.?\)|\[[^\]]*\]|\s(?:v|n|adj)\.$/i;

const TEXT_FIELDS = ['german', 'english', 'plural', 'example_de', 'example_en', 'notes'];

/** @returns {{id: string, rule: string, detail: string}[]} */
export function validateVocab(entries) {
  const errors = [];
  const fail = (entry, rule, detail) =>
    errors.push({ id: entry?.id ?? '(no id)', rule, detail });

  if (!Array.isArray(entries)) {
    return [{ id: '(file)', rule: 'shape', detail: 'vocab.json must be a single JSON array' }];
  }

  const seenIds = new Map();
  const seenGerman = new Map();

  entries.forEach((e, index) => {
    // Required fields ------------------------------------------------------
    for (const field of ['id', 'german', 'english']) {
      if (typeof e[field] !== 'string') {
        fail(e, 'required-field', `entry #${index} is missing string field "${field}"`);
      }
    }
    if (!Number.isInteger(e.lesson)) {
      fail(e, 'required-field', `"lesson" must be an integer (got ${JSON.stringify(e.lesson)})`);
    }
    if (typeof e.id !== 'string' || typeof e.german !== 'string') return; // can't check further

    // Uniqueness ------------------------------------------------------------
    if (seenIds.has(e.id)) {
      fail(e, 'unique-id', `id "${e.id}" also used by entry #${seenIds.get(e.id)}`);
    } else seenIds.set(e.id, index);
    if (seenGerman.has(e.german)) {
      fail(e, 'unique-german', `german "${e.german}" also used by id "${seenGerman.get(e.german)}"`);
    } else seenGerman.set(e.german, e.id);

    // Whitespace ------------------------------------------------------------
    for (const field of TEXT_FIELDS) {
      const v = e[field];
      if (typeof v !== 'string') continue;
      if (v !== v.trim()) fail(e, 'no-stray-whitespace', `"${field}" has leading/trailing whitespace: ${JSON.stringify(v)}`);
      if (/ {2,}/.test(v)) fail(e, 'no-stray-whitespace', `"${field}" contains a double space: ${JSON.stringify(v)}`);
    }

    // english never empty ---------------------------------------------------
    if (typeof e.english === 'string' && e.english.trim() === '') {
      fail(e, 'english-not-empty', `english is empty`);
    }

    // No part-of-speech annotations ----------------------------------------
    for (const field of ['german', 'english']) {
      if (typeof e[field] === 'string' && POS_ANNOTATION.test(e[field])) {
        fail(e, 'no-pos-annotation', `"${field}" contains a part-of-speech annotation: ${JSON.stringify(e[field])}`);
      }
    }

    // Nouns -----------------------------------------------------------------
    if (e.pos === 'noun') {
      const article = e.german.split(' ')[0];
      if (!ARTICLES.includes(article) || e.german.split(' ').length < 2) {
        fail(e, 'noun-has-article', `noun "${e.german}" must start with der/die/das`);
      } else if (e.gender !== article) {
        fail(e, 'gender-matches-article', `german says "${article}" but gender is ${JSON.stringify(e.gender ?? null)}`);
      }
    }

    // Verbs -----------------------------------------------------------------
    if (e.pos === 'verb') {
      const bare = e.german.replace(/^sich /, '');
      if (/^zu /.test(e.german)) {
        fail(e, 'verb-infinitive', `store the bare infinitive, not "${e.german}"`);
      } else if (bare.includes(' ')) {
        fail(e, 'separable-joined', `verb "${e.german}" must be one word (aufräumen, not "räume auf")`);
      } else if (!/^[a-zäöüß]+n$/.test(bare)) {
        fail(e, 'verb-infinitive', `"${e.german}" does not look like an infinitive (lowercase, ends in -n)`);
      }
      if (typeof e.english === 'string') {
        const alternatives = e.english.split(' / ');
        for (const alt of alternatives) {
          if (!/^to /.test(alt)) {
            fail(e, 'verb-gloss-starts-with-to', `gloss "${alt}" must start with "to " (every alternative in "${e.english}")`);
          }
        }
      }
    }
  });

  return errors;
}

export function formatErrors(errors) {
  const lines = errors.map((e) => `  ✗ [${e.rule}] ${e.id}: ${e.detail}`);
  return `vocab.json failed ${errors.length} convention check(s) — see CLAUDE.md "Storage conventions":\n${lines.join('\n')}`;
}

export function loadAndValidate(file = VOCAB_PATH) {
  let entries;
  try {
    entries = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    return [{ id: '(file)', rule: 'parse', detail: `could not read/parse ${file}: ${err.message}` }];
  }
  return validateVocab(entries);
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = loadAndValidate();
  if (errors.length) {
    console.error(formatErrors(errors));
    process.exit(1);
  }
  const count = JSON.parse(readFileSync(VOCAB_PATH, 'utf8')).length;
  console.log(`vocab.json OK — ${count} entries pass all convention checks`);
}
