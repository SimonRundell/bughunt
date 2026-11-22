import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPuzzlesForTrack, getTrack } from '../api/puzzles'
import { getPuzzleState, loadProgress } from '../store/progress'
import { applyStableRandomOrder } from '../store/puzzleOrder'

/**
 * Puzzle list for one track (BUILD.md 9.1). Puzzle order is randomised
 * once per student and then stable across visits (not re-shuffled every
 * page load) - see applyStableRandomOrder.
 */
export default function Track() {
  const { slug } = useParams()
  const [progress] = useState(() => loadProgress())
  const [track, setTrack] = useState(null)
  const [puzzles, setPuzzles] = useState(null)

  useEffect(() => {
    setTrack(null)
    setPuzzles(null)
    getTrack(slug).then(setTrack)
    getPuzzlesForTrack(slug).then((list) => setPuzzles(applyStableRandomOrder(slug, list)))
  }, [slug])

  if (!track || !puzzles) return <p className="track">Loading track…</p>

  return (
    <div className="track">
      <Link to="/debug" className="btn btn--small back-link">&larr; All tracks</Link>
      <h1>{track.title}</h1>
      <p>{track.intro_md}</p>

      <ul className="track__puzzles">
        {puzzles.map((puzzle) => {
          const state = getPuzzleState(progress, puzzle.slug)
          return (
            <li key={puzzle.slug}>
              <Link to={`/puzzle/${puzzle.slug}`}>
                <span className="track__puzzle-status" aria-hidden="true">
                  {state.solvedAt ? '✓' : '•'}
                </span>
                {puzzle.title}
                <span className="track__puzzle-meta">
                  Difficulty {puzzle.difficulty} · {puzzle.bug_type}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
