import { defineCollection, reference, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

// ---------------------------------------------------------------------------
// Lessons: one markdown file per lesson, chronological.
// The body is the safety valve: anything from the tutor that doesn't fit a
// structured field goes there verbatim rather than being lost.
// ---------------------------------------------------------------------------
const lessons = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lessons' }),
  schema: z.object({
    number: z.number().int().positive(),
    date: z.coerce.date(),
    title: z.string().optional(),
    // slugs matching grammar topic files; validated as references
    topics: z.array(reference('grammar')).default([]),
    homework: z
      .array(z.object({ text: z.string(), done: z.boolean().default(false) }))
      .default([]),
    sources: z.array(z.string()).default([]),
  }),
});

// ---------------------------------------------------------------------------
// Grammar: one file per curriculum topic (10 total), topical not chronological.
// ---------------------------------------------------------------------------
const grammar = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/grammar' }),
  schema: z.object({
    title: z.string(),
    order: z.number().int().min(1).max(10),
    last_updated_lesson: z.number().int().nullable().default(null),
    lessons: z.array(z.number().int()).default([]),
  }),
});

// ---------------------------------------------------------------------------
// Vocab: single JSON array. Structural validation lives here; the storage
// conventions (article present, glosses start with "to", uniqueness, ...)
// are enforced by scripts/validate-vocab.mjs, which fails the build.
// ---------------------------------------------------------------------------
export const pronouns = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'] as const;

export const verbSchema = z.object({
  separable: z.boolean(),
  strength: z.enum(['weak', 'strong', 'mixed']),
  aux: z.enum(['haben', 'sein']),
  // ich/du/er/wir/ihr/sie — any subset; filled in as the tutor provides them
  present: z
    .object({
      ich: z.string().optional(),
      du: z.string().optional(),
      er: z.string().optional(),
      wir: z.string().optional(),
      ihr: z.string().optional(),
      sie: z.string().optional(),
    })
    .nullable()
    .default(null),
  praeteritum: z.string().nullable().default(null),
  partizip_ii: z.string().nullable().default(null),
});

export const vocabSchema = z.object({
  id: z.string(),
  german: z.string(),
  english: z.string(),
  pos: z.enum(['noun', 'verb', 'adjective', 'prefix', 'phrase']).optional(),
  gender: z.enum(['der', 'die', 'das']).nullable().default(null),
  plural: z.string().nullable().default(null),
  example_de: z.string().nullable().default(null),
  example_en: z.string().nullable().default(null),
  lesson: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  notes: z.string().nullable().default(null),
  verb: verbSchema.nullable().default(null),
});

export type VocabEntry = z.infer<typeof vocabSchema>;

const vocab = defineCollection({
  loader: file('src/data/vocab.json'),
  schema: vocabSchema,
});

export const collections = { lessons, grammar, vocab };
