# German learning hub — working instructions for Claude Code

Robyn is learning German from scratch with a Preply tutor, Markus, 2–3 lessons a week. After each
lesson he sends notes and homework, usually RTF/RTFD, in a slightly different format every time.
This repo turns those into one consistent store (lesson notes, vocab, grammar) plus Anki cards, and
publishes it as a static site at <https://robyn-tse.github.io/german/> (GitHub Pages, no backend).

The original build spec is in `docs/build-prompt.md`. Read it if you are about to change structure.

## Layout

| Path | What |
|---|---|
| `src/content/lessons/lesson-NN.md` | One file per lesson, chronological. Body = cleaned notes (markdown). |
| `src/content/grammar/<topic>.md` | One file per curriculum topic. Exactly ten, fixed (list below). Topical, not chronological. |
| `src/data/vocab.json` | Single JSON array of vocab entries. The quiz and vocab table read this. |
| `src/data/exercises.json` | Gap-fill sentences from worksheets, with answer keys. Only the quiz reads it. |
| `src/content.config.ts` | Zod schemas for all three collections. Structural validation at build. |
| `scripts/validate-vocab.mjs` | Storage-convention checks. Runs inside every build via `scripts/astro-vocab-validator.mjs` and **fails the build**. |
| `scripts/export-anki.mjs` | Generates the Anki vocab TSVs for a lesson. |
| `exports/lesson-NN-*.tsv` | Anki import files. |
| `inbox/` | Raw files from Markus land here. |
| `inbox/archive/lesson-NN/` | Processed originals. **Never delete anything here.** |
| `public/sources/lesson-NN/` | Copies of the originals served by the site, linked from the lesson's Materials list. |
| `src/lib/quiz-modes.js` | Quiz mode registry. Adding a mode = adding an object. |
| `.github/workflows/deploy.yml` | Push to `main` → build → GitHub Pages. |

## Commands

```bash
npm run dev        # dev server with --host (test on phone over wifi: http://<laptop-ip>:4321/german/)
npm run build      # validates vocab.json, then builds to dist/
npm run validate   # vocab convention checks only
node scripts/export-anki.mjs 2     # regenerate exports/lesson-02-<category>.tsv
.venv/bin/python   # Python with striprtf installed (see below)
```

Python: the RTF converter lives in a project venv. If `.venv/` is missing:

```bash
python3 -m venv .venv && .venv/bin/pip install striprtf
```

## Ingest procedure — the weekly job

Do this identically every time. Robyn says "process the inbox" (or similar) and you run the whole
thing end to end.

1. **Read everything in `inbox/`** (ignore `inbox/README.md` and `inbox/archive/`). Note the file
   names; they go into the lesson's `sources`.
2. **Convert.** `.rtf` → `rtf_to_text`. `.rtfd` is a ZIP bundle / directory: unzip if needed, read
   `TXT.rtf` inside it, then convert. PDFs: use the Read tool (it renders pages) or `pdftotext` if
   present.
   ```python
   from striprtf.striprtf import rtf_to_text
   text = rtf_to_text(open(path, encoding='utf-8', errors='replace').read())
   ```
   Run it with `.venv/bin/python`.
3. **Work out the lesson number and date.** Next number after the highest existing
   `src/content/lessons/lesson-NN.md`; date from the file/email if given, otherwise ask. Create
   `src/content/lessons/lesson-NN.md` (two-digit NN) with the frontmatter template below and the
   cleaned notes as the body. **The body is a study sheet you would hand a student**: tables,
   rules, examples, and a *Materials* list linking the originals. Nothing else. No descriptions of
   what a worksheet contains, no processing notes, no "this was cut/merged/added" commentary, no
   dates of edits; all of that belongs in the report (step 8) or in this file. Keep the tutor's
   structure and wording; fix only obvious transcription noise. Anything that fits no structured
   field still goes in the body, but as content (a table, a rule), not as a note about content.
   Copy the originals to `public/sources/lesson-NN/` so they are served by the site (an `.rtfd`
   bundle: copy its `TXT.rtf` as `<name>.rtf`); list those filenames in `sources` and link them
   from the *Materials* section with `../../sources/lesson-NN/<file>`. Then open the previous
   lesson's file and mark its homework `done: true`.
4. **Vocab.** Decide first what *is* vocab. Lesson handouts, worksheets and phrase lists are; a
   coursebook glossary or dictionary-style reference (like the 103-page English Compass word list in
   lesson 2) is not: archive it, mention it in the lesson body, and say so in the report.
   Append new entries to `src/data/vocab.json`. Before adding, check for duplicates
   against existing `german` values (and near-duplicates: same word with/without article, different
   gloss). If a word already exists, do not add a second entry; enrich the existing one (add tags,
   fill empty fields, append to `notes`) and report it as "merged into existing". Fill every field
   the source provides — especially `example_de`, `praeteritum`, `partizip_ii`, `present` — even
   though the site does not display all of them yet.
5. **Grammar.** For each topic the lesson touched, append a section to the topic file (grammar is
   cumulative: add, do not rewrite earlier lessons' content), add the lesson number to `lessons`,
   and set `last_updated_lesson`. Add the topic slugs to the lesson's `topics`.
5b. **Exercises.** If a source is a worksheet (gap-fill sentences, article drills), add each
   sentence to `src/data/exercises.json` with the answer key (see schema below). Worksheets usually
   arrive without answers; you work them out and say so in the report. If a mode in
   `src/lib/quiz-modes.js` already covers the `set`, nothing else is needed; otherwise add a mode.
6. **Anki exports.** Run `node scripts/export-anki.mjs NN` for the vocab cards. Hand-write
   `exports/lesson-NN-regeln.tsv` for rule cards (prefixes, suffix rules, patterns) in the same
   format as `exports/lesson-02-regeln.tsv`. Header syntax is fixed:
   ```
   #separator:tab
   #html:false
   #columns:Front	Back	Tags
   ```
   Tags are namespaced `lessonN::category` (`lesson2::verben`, `lesson2::genus`, ...).
7. **Normalize every entry to the storage conventions below.** Markus's materials arrive in a
   different shape every lesson; the stored format must not vary with his. Run `npm run validate`
   and fix everything it names.
8. **Report back** (see template below): what was added, what was skipped or merged as a duplicate,
   **any structured information that had nowhere to go in the schema** (never drop it silently: put
   it in `notes` or the lesson body and propose a schema addition), and **anything in the source
   that looks factually wrong**. The tutor's notes come through an AI note-taker and have contained
   real errors; Robyn wants them called out, not quietly corrected.
9. **Archive.** Move the processed originals to `inbox/archive/lesson-NN/`. Never delete anything
   from the archive; it is the only way to reprocess a lesson months later.
10. **Build, commit, push.** `npm run build` must pass. Commit with a message like
    `Lesson NN: <topics>`; push to `main`, which triggers the Pages deploy. Check
    <https://github.com/robyn-tse/german/actions> if in doubt.

### Report template

```
Lesson NN processed (<date>)
Added: N vocab (N verbs, N nouns, ...), grammar sections in <topics>, exports/lesson-NN-*.tsv
Merged/skipped as duplicates: ...
Had nowhere to go (now in notes / lesson body): ...
Possible errors in the source: ...
Not from the source (added by Claude, standard forms): ...
Homework marked done from lesson NN-1: ...
```

## Storage conventions — enforced by `scripts/validate-vocab.mjs`

Every entry in `vocab.json` follows these rules. The build fails if any entry breaks one.

| Rule | Right | Wrong |
|---|---|---|
| Nouns include their article | `die Zeitung` | `Zeitung` |
| `gender` matches the article in `german` | `die Zeitung` + `gender: die` | `die Zeitung` + `gender: der` |
| Verbs stored as infinitives | `verhandeln` | `verhandelt`, `zu verhandeln` |
| Verb glosses start with "to" | `to negotiate` | `negotiate` |
| No part-of-speech annotations | `to negotiate` | `negotiate (v.)`, `verhandeln [verb]` |
| Separable verbs stored joined | `aufräumen` | `auf räumen`, `räume auf` |
| No trailing or double spaces | `die Wohnung` | `die Wohnung ` |
| `english` is never empty | | |
| `id` and `german` are each unique across the file | | |

These conventions are arbitrary; either choice would work. The cost of inconsistency is that the
quiz becomes untrustworthy, and an untrustworthy quiz is worse than no quiz. The script is the thing
that remembers which convention we picked. Do not downgrade a check to a warning.

Additional conventions the script does not check but you must follow:

- Multiple glosses are separated by ` / ` and **each** alternative starts with "to" for verbs:
  `to acquire / to take over`, not `to acquire / take over`.
- Noun glosses start with "the": `the newspaper`.
- `id` is an ASCII slug: lowercase, `ä→ae ö→oe ü→ue ß→ss`, nouns without the article
  (`zeitung`), prefixes as `prefix-ab`. Ids never change once committed (quiz stats key on them).
- Store `plural`, `example_de`, `example_en` as `null` when the source does not give them; never
  omit the key. The site shows a subtle ◌ marker on incomplete entries.
- `verb.praeteritum` / `verb.partizip_ii` are stored as bare forms in the ich-form as the tutor
  gives them: `erwarb`, `erworben`; separable verbs `setzte um`, `umgesetzt`. The auxiliary goes in
  `verb.aux`, not in the participle.
- `verb.present` holds only the pronouns the source actually gives (often just `ich`).
- `tags` in use: `trennbar`, `untrennbar` (verbs with a separable/inseparable prefix; the Prefix
  quiz mode filters on these), `genus` (gender-by-suffix example nouns), `merken` (memorise —
  irregular forms). Reuse these; add a new tag only when a lesson introduces a genuinely new
  category, and list it here.
- **Source first.** Fields that come from Markus's material take precedence. You may fill standard
  forms you are certain of (e.g. Partizip II of a common verb the lesson used only as an example),
  but list every such addition in the report under "Not from the source". Never invent plurals or
  example sentences; leave them `null`. Genders for nouns that a source lists without an article
  (phrase lists, worksheets) are the one exception: add them, and list them in the report.
- `notes` is the catch-all for anything with no field (stem-vowel changes, "über- is inseparable
  here", cross-references).

### Gender rule template

```json
{ "id": "suffix-ung", "suffix": "-ung", "gender": "die", "examples": ["die Zeitung", "die Wohnung"], "lesson": 2, "tags": ["genus"], "notes": null }
```

Prefix rules use a trailing hyphen in `id`/`suffix` semantics (`"suffix": "Ge-"`). Longest match wins in the quiz (-ment beats -ent).

### Vocab entry template

```json
{
  "id": "erwerben",
  "german": "erwerben",
  "english": "to acquire",
  "pos": "verb",
  "gender": null,
  "plural": null,
  "example_de": "Unternehmen erwerben innovative KI-Start-ups.",
  "example_en": "Companies acquire innovative AI start-ups.",
  "lesson": 2,
  "tags": ["untrennbar"],
  "notes": null,
  "verb": {
    "separable": false,
    "strength": "strong",
    "aux": "haben",
    "present": { "ich": "erwerbe" },
    "praeteritum": "erwarb",
    "partizip_ii": "erworben"
  }
}
```

`pos` is one of `noun | verb | adjective | prefix | phrase | adverb | preposition | conjunction |
pronoun | number | other`. Nouns: `gender` set, `verb: null`. Non-verbs: `verb: null`.

More conventions that came out of lesson 2's phrase list and worksheets:

- Number words are lowercase (`eins`, `zwanzig`); `die Million` / `die Milliarde` are nouns.
  Ordinals are stored as the bare stem (`erste`) with the declension pattern in `notes`.
- Question words, adverbs and other function words are lowercase (`wo`, `ja`), whatever the source does.
- A word that is repeated in a source with different glosses becomes one entry with the glosses
  joined by ` / ` (`fahren` → `to drive / to ride`, `über` → `about / above / across / over`).
- Nouns listed in the plural are stored in the singular with a note (`die Lippe`, not `Lippen`);
  plural-only nouns keep `die` and get `Plural-only noun.` in `notes` (`die Eltern`).
- A source headword that is really two alternatives (`Trolley / Warenkorb`) is stored under the
  natural German word with the alternative in `notes`.
- Tags from lesson 2 you should reuse: `wortliste` plus a section tag (`alltag`, `vorstellen`,
  `begruessung`, `reise`, `wegbeschreibung`, `zeit`, `orte`, `einkaufen`, `restaurant`, `hotel`,
  `zahlen`, `koerper`) for phrase-list material; `artikel-uebung` for nouns that come from article
  worksheets.

### Exercise entry template

```json
{
  "id": "ex-praefix-001",
  "lesson": 2,
  "set": "trennbar-praesens",
  "prompt_de": "Ich ___ jeden Morgen um 6 Uhr ___.",
  "hint": "aufstehen",
  "answer": "stehe auf",
  "full_de": "Ich stehe jeden Morgen um 6 Uhr auf.",
  "en": "I get up every morning at 6 o'clock.",
  "vocab_id": "aufstehen",
  "tags": ["trennbar"]
}
```

`set` names one worksheet section and is what a quiz mode filters on. Sets so far:
`trennbar-praesens`, `trennbar-modal`, `gemischt` (verb gap-fills), `artikel-bestimmt`,
`artikel-unbestimmt` (article choice). Two gaps are answered as one string with a space
(`stehe auf`); the quiz shows it as `stehe … auf`. Ids are `ex-<sheet>-NNN`.

### Lesson frontmatter template

```yaml
---
number: 3
date: 2026-09-11
title: Short descriptive title
topics: [plurals, verb-conjugation]      # grammar slugs; validated against the grammar collection
homework:
  - text: "Conjugate 10 weak verbs"
    done: false
sources: ["Lektion3.rtf"]
---
```

### Grammar topics (fixed, in curriculum order)

`articles`, `verb-conjugation`, `plurals`, `prefixes`, `declension`, `perfekt`, `clauses`,
`adjectives`, `infinitive-sentences`, `passive-voice`.

Frontmatter: `title`, `order` (1–10), `last_updated_lesson`, `lessons: [2, 5]`. A topic with an
empty body shows as "not covered yet" on the site. Do not create new topic files; if Markus covers
something outside the ten (possessive pronouns in lesson 2, for example), put it in the lesson body
under "Also in the handout" and mention it in the report.

## Quiz modes

`src/lib/quiz-modes.js` is a registry. A mode is `{ id, label, description, filter, prompt, answer,
input, source?, subprompt?, accept?, reveal? }`. `source` is `'vocab'` (default) or `'exercises'`.
To add one, add an object; the page picks it up, and lesson pages link to it with `?mode=<id>` for
the exercise sets it covers. Current modes: DE→EN, EN→DE, Gender, Prefix, Partizip II, Verb im
Satz (worksheet gap-fill), der/die/das im Satz, ein/eine/einen. Sketches for plural,
Partizip II, present-tense and case modes are commented at the bottom of that file. Typed answers go
through `src/lib/compare.js` (case-insensitive, trimmed, umlaut/ß tolerant but flagged). Do not add
spaced repetition; Anki owns scheduling.

## Site conventions

- Astro 7, static output, `base: '/german'`. Build internal links with `url()` from `src/lib/url.ts`;
  never hardcode `/german/`.
- Links inside markdown content are relative to the page URL. A lesson lives at
  `/lessons/N/`, so link to a topic with `../../grammar/<slug>/`; a grammar page lives at
  `/grammar/<slug>/`, so it links to a lesson with `../../lessons/N/`.
- Plain CSS, tokens in `src/styles/global.css`. Gender colours are `--der / --die / --das`; the
  article is always also shown as text.
- No JS framework. The only client scripts are the vocab filter and the quiz.
- `noindex` is set sitewide in `src/layouts/Base.astro`.
- Do not build: dashboards, global search, interactive homework, audio, or any AI feature in the site.

## What counts as vocab, and the essentials set

Robyn is starting from zero and wants a **small, concentrated set** first, not hundreds of words.
So:

- **Vocab sources are the tutor's vocabulary lists only**: `50_Verben.rtf` (tag `verben50`) and
  the phrase list `4Wortliste` (tag `wortliste`). Words that merely appear in worksheets, handout
  example tables or grammar explanations are **not** vocab entries; worksheets go to
  `exercises.json`, handout rules to the grammar pages and `gender-rules.json`.
- Every entry that belongs to the starter core carries the tag **`essentials`**. The vocab table,
  the quiz and the lesson page show essentials by default with a one-tap "show all". When adding a
  lesson, tag the handful of words the tutor actually drilled as essentials; leave list padding
  untagged. Keep essentials well under ~250 in total; if it grows past that, ask before adding more.
- The English Compass word list (`1Wortliste_A1_A2_B1.pdf`, 4,000 rows) is parsed by
  `scripts/parse-compass.py` but **not loaded**. If Robyn later wants some of it, pull a chosen
  subset, not all of A1.
- Gender content is **rules only** (ending → article) from the article handout and the Das Akademie
  chart, in `src/data/gender-rules.json`; there is no category memorisation (months, seasons …).
  The *Gender* quiz mode only asks nouns a rule applies to; *Gender rule* asks the endings.
- Genders for phrase-list nouns without articles were added by Claude and are listed in the report.
