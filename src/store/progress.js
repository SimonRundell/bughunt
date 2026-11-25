/**
 * localStorage-only progress store (BUILD.md 9.4). No accounts, no server
 * round trip - every read and write is wrapped in try/catch because
 * storage can be blocked, full, or hand-edited into something invalid.
 * The shape is versioned so a future change can migrate old saves instead
 * of silently discarding them.
 */
import { BADGES, STREAK_TIERS, trackCompleteBadgeId } from '../config/scoring'

export const STORAGE_KEY = 'bughunt.progress.v1'
export const CURRENT_VERSION = 1

// A non-cryptographic integrity check on the saved blob - the same category
// of "soft control" as BUILD.md 5.3's hidden-test handling, not real
// security (there's no account/server to verify against, and anyone
// willing to read this file can reproduce the hash). It exists to stop the
// common case reported in practice: pasting a hand-edited object straight
// into localStorage.setItem - the pasted copy won't carry a matching _sig,
// so it's treated as corrupt rather than silently accepted. A save made
// before this check existed (no _sig at all) is accepted once and then
// re-signed on its next save, so nobody's real progress is wiped by this
// patch landing.
const INTEGRITY_PEPPER = 'bh-progress-9f2c71'

/**
 * JSON.stringify with every object's keys sorted (recursively, arrays keep
 * their own order) so the result only depends on the data, never on
 * incidental insertion order - `progress.puzzles` in particular is built
 * up one `{...spread}` at a time in whatever order puzzles were solved.
 * @param {*} value
 * @returns {string}
 */
function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** 32-bit FNV-1a, returned as an 8-character hex string. */
function fnv1a(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** @param {object} progress @returns {string} signature over every field except `_sig` itself */
function computeSignature(progress) {
  const { _sig, ...rest } = progress
  return fnv1a(INTEGRITY_PEPPER + canonicalStringify(rest))
}
/** Dispatched on `window` after every successful save, so long-lived
 * components (e.g. the site header's XP bar) can refresh without a
 * dedicated store/context - see SiteHeader.jsx. */
export const PROGRESS_CHANGED_EVENT = 'bughunt-progress-changed'

/** @returns {object} a brand-new, empty progress object */
export function createEmptyProgress() {
  return {
    version: CURRENT_VERSION,
    xp: 0,
    badges: [],
    streak: { days: 0, lastDate: null },
    puzzles: {},
  }
}

/** @returns {object} a brand-new, empty per-puzzle state entry */
function createEmptyPuzzleState() {
  return {
    solvedAt: null,
    attempts: 0,
    testRuns: 0,
    hintsUsed: [],
    usedTrace: false,
    diagnosis: { line: null, type: null, correct: null },
    xpAwarded: 0,
    draftCode: null,
  }
}

/**
 * Migrates an older saved shape forward. There is only version 1 so far;
 * this is the seam a version 2 migration would hang off.
 * @param {object} saved
 * @returns {object}
 */
function migrate(saved) {
  if (saved.version === CURRENT_VERSION) return saved
  // Unknown/older version: safest fallback is a fresh start rather than
  // guessing at a shape that might not exist yet.
  return createEmptyProgress()
}

/** @returns {object} the stored progress, or a fresh one if missing/corrupt */
export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyProgress()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') {
      return createEmptyProgress()
    }
    // A save from before the integrity check existed has no _sig at all -
    // accept it once rather than wipe real progress; saveProgress stamps
    // one on the next write. A save that HAS a _sig but doesn't match was
    // edited by something other than this code, so it's treated as corrupt.
    if (typeof parsed._sig === 'string' && parsed._sig !== computeSignature(parsed)) {
      return createEmptyProgress()
    }
    return migrate(parsed)
  } catch {
    return createEmptyProgress()
  }
}

/** @param {object} progress @returns {boolean} whether the save succeeded */
export function saveProgress(progress) {
  try {
    const signed = { ...progress, _sig: computeSignature(progress) }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signed))
    window.dispatchEvent(new CustomEvent(PROGRESS_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

/** @param {object} progress @param {string} slug @returns {object} that puzzle's state, or a fresh one */
export function getPuzzleState(progress, slug) {
  return progress.puzzles[slug] ?? createEmptyPuzzleState()
}

/**
 * Merges a partial patch into one puzzle's state, returning a new progress
 * object (does not mutate the input). Used for incremental updates during
 * play: a test run, a hint reveal, a draft-code autosave.
 * @param {object} progress
 * @param {string} slug
 * @param {Partial<ReturnType<typeof createEmptyPuzzleState>>} patch
 */
export function updatePuzzleState(progress, slug, patch) {
  const current = getPuzzleState(progress, slug)
  return {
    ...progress,
    puzzles: {
      ...progress.puzzles,
      [slug]: { ...current, ...patch },
    },
  }
}

function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysBetween(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  const from = new Date(fy, fm - 1, fd)
  const to = new Date(ty, tm - 1, td)
  return Math.round((to - from) / 86400000)
}

/**
 * Advances the daily streak counter. Call once per solved puzzle (not per
 * give-up or test run) - solving more than once in a day doesn't advance
 * it further, a gap of more than one day resets it.
 * @param {object} streak @param {Date} [now]
 */
function advanceStreak(streak, now = new Date()) {
  const today = todayKey(now)
  if (streak.lastDate === today) return streak
  if (streak.lastDate === null) return { days: 1, lastDate: today }
  const gap = daysBetween(streak.lastDate, today)
  return gap === 1 ? { days: streak.days + 1, lastDate: today } : { days: 1, lastDate: today }
}

/**
 * Records a successful solve: XP, solvedAt, streak, and any newly-earned
 * badges. `context` supplies the puzzle/track facts the store itself has
 * no business knowing (content lives in the puzzle source, not here).
 *
 * @param {object} progress
 * @param {object} opts
 * @param {string} opts.slug
 * @param {string} opts.trackSlug
 * @param {string} opts.bugType
 * @param {number} opts.xpAwarded
 * @param {boolean} [opts.usedTrace]
 * @param {string[]} opts.trackPuzzleSlugs - every puzzle slug in this puzzle's track
 * @returns {object} new progress
 */
export function recordSolve(progress, { slug, trackSlug, bugType, xpAwarded, usedTrace = false, trackPuzzleSlugs = [] }) {
  const current = getPuzzleState(progress, slug)
  const alreadySolved = current.solvedAt !== null
  const hintsUsed = current.hintsUsed
  // Only a puzzle's first solve pays out XP - re-solving an already-solved
  // puzzle doesn't farm more (BUILD.md 9.3 only promises XP for retrying
  // after a Give Up, i.e. a puzzle that was never solved).
  const awardedXp = alreadySolved ? 0 : xpAwarded

  let next = {
    ...progress,
    xp: progress.xp + awardedXp,
    puzzles: {
      ...progress.puzzles,
      [slug]: { ...current, solvedAt: current.solvedAt ?? new Date().toISOString(), xpAwarded: current.xpAwarded + awardedXp },
    },
  }

  if (!alreadySolved) {
    next.streak = advanceStreak(progress.streak)
    next = awardBadge(next, 'first-fix', Object.values(next.puzzles).filter((p) => p.solvedAt).length === 1)

    const isEarlyTrack = trackSlug === 'spot-the-typo' || trackSlug === 'crash-course'
    next = awardBadge(next, 'read-the-error', isEarlyTrack && hintsUsed.length === 0)
    next = awardBadge(next, 'trace-master', bugType === 'logic' && usedTrace)
    next = awardBadge(next, 'boss-slayer', trackSlug === 'boss-fights')
    for (const tier of STREAK_TIERS) {
      next = awardBadge(next, `streak-${tier}`, next.streak.days >= tier)
    }

    if (trackPuzzleSlugs.length > 0) {
      const allSolved = trackPuzzleSlugs.every((s) => next.puzzles[s]?.solvedAt)
      next = awardBadge(next, trackCompleteBadgeId(trackSlug), allSolved)
      const allSolvedNoHints = allSolved && trackPuzzleSlugs.every((s) => (next.puzzles[s]?.hintsUsed ?? []).length === 0)
      next = awardBadge(next, 'no-hints-track', allSolvedNoHints)
    }
  }

  return next
}

function awardBadge(progress, badgeId, earned) {
  if (!earned || progress.badges.includes(badgeId)) return progress
  return { ...progress, badges: [...progress.badges, badgeId] }
}

/** @param {string} badgeId @returns {{title: string, description: string}} falls back to a generic shape for track-complete-* ids */
export function describeBadge(badgeId) {
  if (BADGES[badgeId]) return BADGES[badgeId]
  if (badgeId.startsWith('track-complete-')) {
    return { title: 'Track Complete', description: `Completed every puzzle in the ${badgeId.replace('track-complete-', '')} track.` }
  }
  return { title: badgeId, description: '' }
}

/**
 * Records a "Give up": an attempt, but no XP and no solvedAt - the puzzle
 * stays available to retry for XP later (BUILD.md 9.3).
 */
export function recordGiveUp(progress, slug) {
  const current = getPuzzleState(progress, slug)
  return updatePuzzleState(progress, slug, { attempts: current.attempts + 1 })
}

/** @param {object} progress @returns {string} pretty-printed JSON for download */
export function exportProgress(progress) {
  // Re-sign rather than export whatever _sig (stale or absent) happens to
  // be on the in-memory object - keeps the downloaded file self-consistent
  // even though importProgress itself doesn't require a valid signature
  // (export/import is a deliberate transfer between browsers, not
  // something loadProgress's tamper check should ever block).
  return JSON.stringify({ ...progress, _sig: computeSignature(progress) }, null, 2)
}

/**
 * Parses and validates an imported progress file.
 * @param {string} json
 * @returns {{ ok: true, progress: object } | { ok: false, error: string }}
 */
export function importProgress(json) {
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number' || typeof parsed.puzzles !== 'object') {
      return { ok: false, error: 'That file doesn\'t look like a BugHunt progress export.' }
    }
    return { ok: true, progress: migrate(parsed) }
  } catch {
    return { ok: false, error: 'That file isn\'t valid JSON.' }
  }
}
