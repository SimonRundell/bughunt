import { RANKS, getRank } from '../config/scoring'

/**
 * Current rank and a progress bar toward the next one (BUILD.md 3.5, 9.1).
 * @param {object} props
 * @param {number} props.xp
 */
export default function XpBar({ xp }) {
  const rank = getRank(xp)
  const rankIndex = RANKS.findIndex((r) => r.name === rank)
  const next = RANKS[rankIndex + 1]
  const floor = RANKS[rankIndex].minXp
  const fraction = next ? Math.min(1, (xp - floor) / (next.minXp - floor)) : 1

  return (
    <div className="xp-bar">
      <div className="xp-bar__labels">
        <strong>{rank}</strong>
        <span>
          &nbsp; {xp} XP{next ? ` · ${next.minXp - xp} to ${next.name}` : ' · Max rank'}
        </span>
      </div>
      <div className="xp-bar__track">
        <div className="xp-bar__fill" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  )
}
