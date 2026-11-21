import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTracks } from '../api/puzzles'

/**
 * Track map (BUILD.md 9.1): every track is visible, unlocked in order but
 * skippable with a "Show me anyway" link rather than hard-gated. The
 * brand/XP bar lives in SiteHeader (mounted once in App.jsx), not here.
 */
export default function Home() {
  const [tracks, setTracks] = useState(null)

  useEffect(() => {
    getTracks().then(setTracks)
  }, [])

  if (!tracks) {
    return <p className="home">Loading tracks…</p>
  }

  return (
    <div className="home">
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
        <Link to="/playground" className="btn">
          Playground
        </Link>
        <Link to="/progress" className="btn">
          Progress
        </Link>
        <Link to="/admin" className="btn">
          Admin
        </Link>
      </nav>
    </div>
  )
}
