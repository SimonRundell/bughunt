/**
 * Per-track puzzle order, randomised once per student and then stable
 * across visits (so a track's list doesn't reshuffle under someone
 * partway through it). Stored per track in localStorage; new puzzles
 * that weren't in a previously-stored order are appended at the end.
 */

function storageKey(trackSlug) {
  return `bughunt.trackOrder.${trackSlug}`
}

function shuffle(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * @param {string} trackSlug
 * @param {{slug: string}[]} puzzles - as returned by getPuzzlesForTrack
 * @returns {{slug: string}[]} the same puzzles, reordered
 */
export function applyStableRandomOrder(trackSlug, puzzles) {
  const bySlug = new Map(puzzles.map((p) => [p.slug, p]))
  let storedOrder = []

  try {
    const raw = localStorage.getItem(storageKey(trackSlug))
    storedOrder = raw ? JSON.parse(raw) : []
  } catch {
    storedOrder = []
  }

  const knownSlugs = new Set(puzzles.map((p) => p.slug))
  const stillValid = storedOrder.filter((slug) => knownSlugs.has(slug))
  const newSlugs = puzzles.map((p) => p.slug).filter((slug) => !stillValid.includes(slug))
  const finalOrder = [...stillValid, ...shuffle(newSlugs)]

  try {
    localStorage.setItem(storageKey(trackSlug), JSON.stringify(finalOrder))
  } catch {
    // localStorage unavailable - the shuffle still works for this page view,
    // it just won't persist across visits.
  }

  return finalOrder.map((slug) => bySlug.get(slug)).filter(Boolean)
}
