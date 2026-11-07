// Helpers for the articles from GET /articles (api/articles.py).
//
// Each language is a separate document with an id like `en-06-missed-choice`
// / `ar-06-…`: the number pairs an article with its translation.

/** The article's number ('06'), shared by its English and Arabic versions. */
export const articleNumber = (id) => /^[a-z]{2}-(\d+)/i.exec(String(id))?.[1] ?? null;

/** Articles in reading order (by number). */
export const sortArticles = (list) =>
  [...list].sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));

/** The article with the same number as [id] in [list] (its translation), or undefined. */
export function counterpartOf(id, list) {
  const n = articleNumber(id);
  return n === null ? undefined : list.find((a) => articleNumber(a.id) === n);
}

/** A plain-text teaser from a markdown body: its first real paragraph. */
export function excerpt(markdown) {
  const paragraph =
    String(markdown ?? '')
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .find((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('```')) ?? '';
  return paragraph
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/^[-*+]\s+|^\d+\.\s+/gm, '') // list markers
    .replace(/[*_`>~]/g, '') // emphasis, code, quotes
    .replace(/\s+/g, ' ')
    .trim();
}
