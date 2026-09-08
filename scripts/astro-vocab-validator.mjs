// Astro integration: runs the vocab convention checks as part of every build.
// A violation throws, which fails `astro build` (and therefore the Pages
// deploy) and prints the offending entries. In dev it logs the same errors on
// startup so they're not missed.
import { loadAndValidate, formatErrors } from './validate-vocab.mjs';

export default function vocabValidator() {
  return {
    name: 'vocab-validator',
    hooks: {
      'astro:build:start': () => {
        const errors = loadAndValidate();
        if (errors.length) throw new Error(formatErrors(errors));
      },
      'astro:server:setup': ({ logger }) => {
        const errors = loadAndValidate();
        if (errors.length) logger.error(formatErrors(errors));
        else logger.info('vocab.json passes all convention checks');
      },
    },
  };
}
