// @ts-check
import { defineConfig } from 'astro/config';
import vocabValidator from './scripts/astro-vocab-validator.mjs';

// GitHub Pages project site: https://robyn-tse.github.io/german/
// `site` + `base` must match the repo owner/name or every link and asset breaks.
export default defineConfig({
  site: 'https://robyn-tse.github.io',
  base: '/german',
  output: 'static',
  trailingSlash: 'always',
  // Keep classic whitespace handling; Astro 7's default 'jsx' mode collapses
  // spaces between inline elements, which bites the article/noun markup.
  compressHTML: true,
  integrations: [vocabValidator()],
});
