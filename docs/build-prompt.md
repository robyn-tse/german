# Build prompt: German learning hub

Paste this into Claude Code at the root of a new empty repo.

---

## Context

I'm learning German from scratch with a Preply tutor (Markus), 2–3 lessons per week. After each lesson he sends notes and homework, usually as RTF files, in a slightly different format each time. I currently process those by hand into Anki flashcards. I want a website that becomes my home base for lesson notes, vocabulary, grammar rules, and light drilling.

I'm two lessons in and expect to keep going for months. **Build the smallest thing that works.** I'd rather add pages later than maintain scaffolding I don't use yet.

Public GitHub repo, deployed to GitHub Pages so I can reach it from my phone anywhere. No backend, no database, no auth.

## Stack — keep it minimal

- **Astro**, static output
- **TypeScript** only for the content schemas (Astro provides this natively)
- **Plain CSS** with custom properties, using Astro's scoped styles. No CSS framework.
- **No JavaScript framework.** The quiz is the only interactive piece — write it in vanilla JS.
- Deployed via **GitHub Actions to GitHub Pages**

Astro's content collections API changed significantly between major versions. **Check the current Astro docs before writing collection code — do not write the API from memory.** Same for the Pages deployment action. If you're unsure a function or option exists, verify it rather than guessing.

Two deployment specifics:

- GitHub Pages serves project sites from a subpath (`username.github.io/repo-name`), so configure Astro's `base` and `site` accordingly. Getting this wrong breaks every internal link and asset — verify against current Astro deployment docs.
- Add a `noindex` meta tag sitewide.

Also configure the dev server with `--host` so I can test on my phone over wifi before deploying.

## Data model — do NOT simplify this

Pages are cheap to add later. Data I failed to capture is expensive to backfill. Keep the full schema even though the v1 site won't display all of it.

### `src/content/lessons/*.md`

Frontmatter:
```
number: 2
date: 2026-09-08
topics: [articles, verb-conjugation, prefixes]   # slugs matching grammar topics
homework:
  - text: "Conjugate 10 weak verbs"
    done: false
sources: ["50_Verben.rtf"]
```
Body is the lesson notes as markdown. **This body is the safety valve** — anything from Markus that doesn't fit the structured schema goes here verbatim rather than being lost.

### `src/data/vocab.json`

One array. Each entry:
```
id            string, stable slug
german        string    # noun WITH article, verb as infinitive
english       string
pos           "noun" | "verb" | "adjective" | "prefix" | "phrase"
gender        "der" | "die" | "das" | null
plural        string | null
example_de    string | null
example_en    string | null
lesson        number
tags          string[]      # e.g. "merken", "trennbar", "untrennbar", "genus"
notes         string | null # freeform catch-all for anything with no field above
verb          object | null:
  separable   boolean
  strength    "weak" | "strong" | "mixed"
  aux         "haben" | "sein"
  present     object | null    # ich/du/er/wir/ihr/sie — optional, filled in later
  praeteritum string | null    # e.g. "erwarb"
  partizip_ii string | null    # e.g. "erworben"
```

Capture `praeteritum` and `partizip_ii` whenever the source provides them, even though nothing displays or quizzes on them yet. Markus's materials already include these forms, and Perfekt is topic six of the curriculum — discarding them now means reprocessing every lesson later.

Everything except `id`, `german`, `english`, and `lesson` is optional, so the schema can grow without breaking existing entries. Store `plural` and `example_de` as empty rather than omitting them, and show a subtle marker on incomplete entries.

### `src/content/grammar/*.md`

**One file per curriculum topic, not per lesson.** Markus follows a 10-topic curriculum and multiple lessons touch the same topic — lesson 2 covered verb conjugation and lesson 7 will too. Grammar is topical; lessons are chronological. Create all ten up front, mostly empty:

`articles`, `verb-conjugation`, `plurals`, `prefixes`, `declension`, `perfekt`, `clauses`, `adjectives`, `infinitive-sentences`, `passive-voice`

Frontmatter tracks `last_updated_lesson` and `lessons: [1, 2]`. Topic pages link back to their lessons; lessons link forward to their topics.

## Ingest pipeline — the core of the project

This is what I use every week for months. Everything else is scaffolding around it.

I drop raw files from Markus into `/inbox/`. Then I ask you (Claude Code) to process them. Write a **`CLAUDE.md`** at the repo root documenting the exact procedure so every future session does it identically:

1. Read everything in `/inbox/`
2. RTFD files are ZIP bundles — unzip, read `TXT.rtf`, convert with `striprtf` (`from striprtf.striprtf import rtf_to_text`, `encoding='utf-8', errors='replace'`)
3. Create `src/content/lessons/lesson-NN.md` with frontmatter and cleaned notes; mark any homework from the previous lesson as `done: true`
4. Append new vocab to `vocab.json`, **checking for duplicates** against existing entries
5. Append grammar content to the relevant topic files, bumping `last_updated_lesson`
6. Emit Anki TSVs to `/exports/lesson-NN-*.tsv` — Anki header syntax (`#separator:tab`, `#html:false`, `#columns:Front Back Tags`), tags namespaced `lessonN::category`
7. **Normalize every entry to the conventions below.** Markus's materials arrive in a different shape every lesson — the stored format must not vary with his.
8. Report back: what was added, what was skipped as a duplicate, **any structured information that had nowhere to go in the schema** (never drop it silently — use the `notes` field or propose a schema addition), and **anything in the source that looks factually wrong**, since my tutor's notes are transcribed by an AI note-taker and have contained real errors
9. Move processed files to `/inbox/archive/`. **Never delete anything from the archive.** These originals are the only way to reprocess if a mistake surfaces months later.
10. Commit and push, which triggers the Pages deploy

The Anki export is not optional — it's my existing spaced-repetition workflow and this site does not replace it.

## Storage conventions — and a script that enforces them

Every entry in `vocab.json` follows these rules. Put this list in `CLAUDE.md` verbatim.

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

**Write a validation script and run it as part of the build.** If any entry breaks a rule, the build fails and names the offending entry and rule. Do not make it a warning — a warning gets ignored, and a single inconsistent gloss silently marks correct quiz answers wrong.

This matters more than it looks. These conventions are arbitrary; either choice would work. The cost of inconsistency is that the quiz becomes untrustworthy, and an untrustworthy quiz is worse than no quiz. Months from now nobody will remember which convention we picked, so the script has to be the thing that remembers.

## Pages — four, no more

**Lessons** (landing page) — reverse-chronological list. Each lesson page shows notes, homework, vocab introduced, and links to the grammar topics it touched.

**Vocab** — one table across all lessons. This is the surface that gets large, so **filtering matters far more than visual polish**: filter by lesson, part of speech, gender, tag; free-text match on German and English; sortable. Show plural and example on expand.

**Grammar** — the 10 topic pages, with a visible indicator of which are still empty.

**Quiz** — below.

## Quiz — build a mode registry, not individual quizzes

**Practice, not scheduling. Do not build a spaced-repetition algorithm — Anki owns that.** This is quick targeted drilling between lessons.

The important design constraint: **I will keep adding quiz modes for months as new grammar topics arrive.** Do not hardcode each one. Build a single quiz engine and define modes as configuration, so adding a mode later is a few lines rather than a new page.

Every mode is the same four decisions:

- **filter** — which vocab entries qualify
- **prompt** — what the entry shows me
- **answer** — what field the response is checked against
- **input** — `typed`, or `choice` with a set of options

Ship with four modes:

| Mode | Filter | Prompt | Answer | Input |
|---|---|---|---|---|
| DE → EN | any | german | english | typed |
| EN → DE | any | english | german | typed |
| Gender | nouns with a gender | german, article stripped | gender | choice: der / die / das |
| Prefix | verbs with a prefix | german | separable? | choice: separable / inseparable |

Modes I'll likely add later, as a design check — the registry should handle these without structural changes: plural of a noun, Perfekt participle, present-tense conjugation for a given pronoun, case of a noun in an example sentence.

Typing beats multiple choice for the translation modes. Recognition is much easier than recall and gives a false sense of mastery. Use `choice` only where the option set is genuinely small and fixed.

Every mode can be filtered by lesson range and/or tag. Session length default 15.

Typed answers need forgiving comparison: case-insensitive, trimmed, tolerating a missing umlaut or `ss` for `ß` — but flag the difference in the feedback rather than silently accepting it. For EN→DE on a noun, accept the answer with or without the article but always show the correct article in the feedback.

Track attempt and error counts per word in `localStorage`, with a visible reset. Note in the UI that stats are per-device, so my laptop and phone show different numbers — don't try to solve that, just make it non-confusing.

## Design

**Colour-code grammatical gender consistently sitewide.** Der/die/das get three fixed colours wherever a noun appears. Define them as CSS custom properties so I can swap them. Widely used mnemonic in German teaching; the specific colours vary, so pick a legible set. **Never rely on colour alone** — keep the article visible as text too.

Dark mode following system preference. Respect `prefers-reduced-motion`.

Mobile: bottom tab bar (Lessons / Vocab / Grammar / Quiz), thumb-reachable. Desktop: left sidebar, same components. The vocab table needs real thought at mobile width — cards, not a squeezed table.

Typography must render umlauts and ß cleanly at small sizes. Notes and grammar pages are read for comprehension, so give them a comfortable measure and line height.

## Explicitly deferred — do not build these

- Home dashboard with progress stats (nothing to aggregate yet)
- Global search (the vocab filter is enough at this size)
- Interactive homework checkboxes
- Audio or pronunciation
- Any AI features in the site itself — processing happens in Claude Code

## Build order

1. Scaffold, schemas, design tokens, with lesson 2 hand-entered as seed data
2. **Deployment to GitHub Pages working end to end** — do this second, not last. Deploy problems left to the end eat an afternoon.
3. Lessons, Grammar, and Vocab pages
4. Ingest pipeline and `CLAUDE.md`
5. Quiz

Ask me questions if anything is ambiguous rather than picking a direction and building it out.
