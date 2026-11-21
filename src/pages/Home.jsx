import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getTracks } from '../dev/puzzleSource'
import { loadProgress } from '../store/progress'
import XpBar from '../components/XpBar'

/**
 * Track map (BUILD.md 9.1): every track is visible, unlocked in order but
 * skippable with a "Show me anyway" link rather than hard-gated.
 */
export default function Home() {
  const [progress] = useState(() => loadProgress())
  const [tracks] = useState(() => getTracks())

  return (
    <div className="home">
      <header className="home__header">
        <h1>BugHunt</h1>
        <XpBar xp={progress.xp} />
      </header>

      <ul className="home__tracks">
        {tracks.map((track) => (
          <li key={track.slug} className="home__track">
            <Link to={`/track/${track.slug}`}>
              <h2>{track.title}</h2>
              <p>{track.summary}</p>
              <span className="home__track-count">{track.puzzleCount} puzzles</span>
            </Link>
          </li>
        ))}
      </ul>

      <nav className="home__footer-nav">
        <Link to="/playground">Playground</Link>
        <Link to="/progress">Progress</Link>
      </nav>
    </div>
  )
}
