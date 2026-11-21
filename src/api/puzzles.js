import client from './client'

/**
 * Axios-backed replacement for src/dev/puzzleSource.js (Phase 3 switches
 * the player over to the real API - BUILD.md 13). Same function names and
 * return shapes as the local-JSON version, but async since real network
 * calls are involved now.
 */

/** @returns {Promise<object[]>} published tracks, in display order */
export async function getTracks() {
  const res = await client.get('/tracks.php')
  return res.data.data.map((t) => ({ ...t, puzzleCount: t.puzzle_count }))
}

/** @param {string} trackSlug @returns {Promise<object|null>} */
export async function getTrack(trackSlug) {
  const tracks = await getTracks()
  return tracks.find((t) => t.slug === trackSlug) ?? null
}

/** @param {string} trackSlug @returns {Promise<object[]>} list view: slug, title, difficulty, bug_type, xp */
export async function getPuzzlesForTrack(trackSlug) {
  const res = await client.get('/puzzles.php', { params: { track: trackSlug } })
  return res.data.data
}

/** @param {string} slug @returns {Promise<object|null>} full puzzle detail for the player */
export async function getPuzzle(slug) {
  const res = await client.get('/puzzle.php', { params: { slug } })
  return res.data.data
}

/** @param {string} slug @param {number} tier 1-3 @returns {Promise<string|null>} hint_md */
export async function getHint(slug, tier) {
  const res = await client.get('/hint.php', { params: { slug, tier } })
  return res.data.data.hint_md
}

/** @param {string} slug @returns {Promise<object|null>} fixed_code, bugs, explanation_md, spot_it_md */
export async function getSolution(slug) {
  const res = await client.get('/solution.php', { params: { slug } })
  return res.data.data
}

/** @returns {Promise<object[]>} concept list: slug, title, summary */
export async function getConcepts() {
  const res = await client.get('/concepts.php')
  return res.data.data
}

/** @param {string} slug @returns {Promise<object|null>} full concept lesson */
export async function getConcept(slug) {
  const res = await client.get('/concept.php', { params: { slug } })
  return res.data.data
}
