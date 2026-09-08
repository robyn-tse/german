/**
 * Prefix an internal path with the configured `base` (GitHub Pages serves the
 * site from /german/). Always returns a trailing-slash directory URL for
 * pages, matching `trailingSlash: 'always'`.
 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  let p = path.replace(/^\//, '');
  if (p !== '' && !p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return `${base}/${p}`;
}
