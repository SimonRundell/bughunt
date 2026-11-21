/**
 * Scoring, hint penalties, ranks and badge definitions (BUILD.md 3.5).
 * `DEFAULT_SCORING` is the built-in fallback; `mergeScoringConfig` layers
 * the `app.scoring` block from `/api/public-config.php` on top, so an admin
 * can retune values without a code change once Phase 3 wires that call in.
 */

/** @typedef {{ xpByDifficulty: number[], hintPenaltyPct: number[], maxHintPenaltyPct: number, diagnosisBonusPct: number, cleanSolveBonusPct: number, cleanSolveMaxRuns: number }} ScoringConfig */

/** @type {ScoringConfig} */
export const DEFAULT_SCORING = {
  // Index 0 unused; difficulty is 1-5.
  xpByDifficulty: [0, 10, 20, 35, 55, 80],
  // Cumulative: using tier 2 costs tier 1's penalty too.
  hintPenaltyPct: [0, 0.15, 0.25, 0.4],
  maxHintPenaltyPct: 0.6,
  diagnosisBonusPct: 0.2,
  cleanSolveBonusPct: 0.1,
  cleanSolveMaxRuns: 3,
}

/**
 * Merges a partial override (e.g. from public-config's `app.scoring`) over
 * the defaults. Missing or malformed keys fall back silently rather than
 * throwing, since this runs on every page load.
 * @param {Partial<ScoringConfig>} [overrides]
 * @returns {ScoringConfig}
 */
export function mergeScoringConfig(overrides) {
  if (!overrides || typeof overrides !== 'object') return DEFAULT_SCORING
  return { ...DEFAULT_SCORING, ...overrides }
}

/**
 * @param {object} opts
 * @param {number} opts.difficulty - 1 to 5
 * @param {number|null} [opts.xpOverride] - puzzle-specific XP, overrides the difficulty table
 * @param {number[]} [opts.hintTiersUsed] - distinct tiers revealed, e.g. [1, 2]
 * @param {boolean} [opts.correctDiagnosis]
 * @param {number} [opts.testRunCount]
 * @param {boolean} [opts.gaveUp]
 * @param {ScoringConfig} [opts.scoring]
 * @returns {number} whole-number XP awarded
 */
export function computeXp({
  difficulty,
  xpOverride = null,
  hintTiersUsed = [],
  correctDiagnosis = false,
  testRunCount = 0,
  gaveUp = false,
  scoring = DEFAULT_SCORING,
}) {
  if (gaveUp) return 0

  const base = xpOverride ?? scoring.xpByDifficulty[difficulty] ?? 0

  const hintPenaltyPct = Math.min(
    hintTiersUsed.reduce((sum, tier) => sum + (scoring.hintPenaltyPct[tier] ?? 0), 0),
    scoring.maxHintPenaltyPct,
  )

  let multiplier = 1 - hintPenaltyPct
  if (correctDiagnosis) multiplier += scoring.diagnosisBonusPct
  if (testRunCount > 0 && testRunCount <= scoring.cleanSolveMaxRuns) multiplier += scoring.cleanSolveBonusPct

  return Math.max(0, Math.round(base * multiplier))
}

/** Rank thresholds, lowest total XP first. The last rank has no ceiling. */
export const RANKS = [
  { name: 'Hatchling', minXp: 0 },
  { name: 'Beetle', minXp: 100 },
  { name: 'Ladybird', minXp: 300 },
  { name: 'Hornet', minXp: 700 },
  { name: 'Mantis', minXp: 1500 },
  { name: 'Exterminator', minXp: 3000 },
]

/** @param {number} totalXp @returns {string} */
export function getRank(totalXp) {
  let current = RANKS[0].name
  for (const rank of RANKS) {
    if (totalXp >= rank.minXp) current = rank.name
  }
  return current
}

/**
 * Static badge metadata. Which badges a student has earned is computed from
 * progress-store state (src/store/progress.js), not stored here.
 */
export const BADGES = {
  'first-fix': { title: 'First Fix', description: 'Solved your first puzzle.' },
  'read-the-error': { title: 'Read the Error', description: 'Solved a Track 1 or 2 puzzle with no hints used.' },
  'trace-master': { title: 'Trace Master', description: 'Solved a logic puzzle after using Trace.' },
  'no-hints-track': { title: 'No Hints', description: 'Completed a whole track without using any hints.' },
  'boss-slayer': { title: 'Boss Slayer', description: 'Solved a Boss Fights puzzle.' },
  streak: { title: 'Streak', description: 'Solved at least one puzzle on 3 days in a row.' },
}

/** @param {string} trackSlug @returns {string} the "Track Complete" badge id for a given track */
export function trackCompleteBadgeId(trackSlug) {
  return `track-complete-${trackSlug}`
}
