/**
 * Phase 2 stand-in for the real API (BUILD.md 5.3): reads
 * `samplePuzzles.json` instead of calling PHP endpoints. Function names and
 * return shapes mirror what `src/api/puzzles.js` will expose in Phase 3, so
 * switching the player over to the live backend only means changing the
 * import, not the pages that use it.
 *
 * Mirrors the public API's one real security property too: `getPuzzle`
 * never includes `fixed_code` or hint text, and hints are only returned one
 * tier at a time via `getHint` - a soft control, not real security, same
 * caveat as BUILD.md 5.3 notes for the live endpoints.
 */
import data from './samplePuzzles.json'

const puzzlesBySlug = new Map(data.puzzles.map((p) => [p.slug, p]))
const tracksBySlug = new Map(data.tracks.map((t) => [t.slug, t]))
const conceptsBySlug = new Map(data.concepts.map((c) => [c.slug, c]))

/** @returns {object[]} published tracks, in display order */
export function getTracks() {
  return data.tracks
    .filter((t) => t.status === 'published')
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((t) => ({
      ...t,
      puzzleCount: data.puzzles.filter((p) => p.track === t.slug).length,
    }))
}

/** @param {string} trackSlug @returns {object|null} */
export function getTrack(trackSlug) {
  return tracksBySlug.get(trackSlug) ?? null
}

/** @param {string} trackSlug @returns {object[]} list view: slug, title, difficulty, bug_type, xp */
export function getPuzzlesForTrack(trackSlug) {
  return data.puzzles
    .filter((p) => p.track === trackSlug)
    .map((p) => ({
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      bug_type: p.bug_type,
      xp: p.xp ?? null,
    }))
}

/**
 * Full puzzle detail for the player - everything except the reference
 * solution and hint text (BUILD.md 5.3: those are separate calls).
 * @param {string} slug
 */
export function getPuzzle(slug) {
  const p = puzzlesBySlug.get(slug)
  if (!p) return null
  return {
    slug: p.slug,
    track: p.track,
    title: p.title,
    difficulty: p.difficulty,
    bug_type: p.bug_type,
    entry_mode: p.entry_mode,
    entry_name: p.entry_name ?? null,
    brief_md: p.brief_md,
    buggy_code: p.buggy_code,
    predict_prompt_md: p.predict_prompt_md ?? null,
    tests: p.tests,
    hint_count: p.hints.length,
    bug_count: p.bugs.length,
    xp: p.xp ?? null,
    concepts: p.concepts,
  }
}

/** @param {string} slug @param {number} tier 1-3 @returns {string|null} hint_md */
export function getHint(slug, tier) {
  const p = puzzlesBySlug.get(slug)
  if (!p) return null
  return p.hints.find((h) => h.tier === tier)?.hint_md ?? null
}

/** @param {string} slug @returns {object|null} fixed_code, bugs, explanation_md, spot_it_md */
export function getSolution(slug) {
  const p = puzzlesBySlug.get(slug)
  if (!p) return null
  return {
    fixed_code: p.fixed_code,
    bugs: p.bugs,
    explanation_md: p.explanation_md,
    spot_it_md: p.spot_it_md ?? null,
  }
}

/** @returns {object[]} concept list: slug, title, summary */
export function getConcepts() {
  return data.concepts.map(({ slug, title, summary }) => ({ slug, title, summary }))
}

/** @param {string} slug @returns {object|null} full concept lesson */
export function getConcept(slug) {
  return conceptsBySlug.get(slug) ?? null
}
