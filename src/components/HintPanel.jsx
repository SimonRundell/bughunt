import ReactMarkdown from 'react-markdown'
import { DEFAULT_SCORING } from '../config/scoring'

const TIER_NAMES = { 1: 'Nudge', 2: 'Pointer', 3: 'Near-answer' }

/**
 * Tiered hints (BUILD.md 3.3): three tiers, unlocked strictly in order.
 * Revealing a hint costs XP (cumulative, shown up front so it never feels
 * like a trap) but never blocks a student from getting unstuck.
 *
 * @param {object} props
 * @param {number} props.hintCount - how many tiers this puzzle actually has (0-3)
 * @param {number[]} props.revealedTiers - tiers already revealed, e.g. [1, 2]
 * @param {Record<number, string>} props.hintContent - markdown per revealed tier
 * @param {(tier: number) => void} props.onReveal
 */
export default function HintPanel({ hintCount, revealedTiers, hintContent, onReveal }) {
  if (hintCount === 0) {
    return <p className="hint-panel__empty">No hints for this puzzle.</p>
  }

  const nextTier = revealedTiers.length + 1

  return (
    <div className="hint-panel">
      {[1, 2, 3].slice(0, hintCount).map((tier) => {
        const revealed = revealedTiers.includes(tier)
        const isNext = tier === nextTier

        return (
          <div key={tier} className="hint-panel__tier">
            <div className="hint-panel__head">
              <strong>
                Hint {tier}: {TIER_NAMES[tier]}
              </strong>
              {!revealed && isNext && (
                <button type="button" className="btn btn--small" onClick={() => onReveal(tier)}>
                  Reveal (-{Math.round(DEFAULT_SCORING.hintPenaltyPct[tier] * 100)}% XP)
                </button>
              )}
            </div>
            {revealed && hintContent[tier] && (
              <div className="hint-panel__content">
                <ReactMarkdown>{hintContent[tier]}</ReactMarkdown>
              </div>
            )}
            {!revealed && !isNext && (
              <p className="hint-panel__locked">Reveal hint {tier - 1} first.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
