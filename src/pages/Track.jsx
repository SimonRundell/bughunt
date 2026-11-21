import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPuzzlesForTrack, getTrack } from '../dev/puzzleSource'
import { getPuzzleState, loadProgress } from '../store/progress'

/**
 * Puzzle list for one track (BUILD.md 9.1).
 */
export default function Track() {
  const { slug } = useParams()
  const [progress] = useState(() => loadProgress())
  const track = getTrack(slug)
  const puzzles = getPuzzlesForTrack(slug)

  if (!track) return <p>Loading track…</p>

  return (
    <div className="track">
      <Link to="/">&larr; All tracks</Link>
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
