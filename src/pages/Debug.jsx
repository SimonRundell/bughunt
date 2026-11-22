import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getTracks } from '../api/puzzles'

/**
 * Track map (BUILD.md 9.1): every track is visible, unlocked in order but
 * skippable with a "Show me anyway" link rather than hard-gated. This used
 * to be the Home page's content - moved to its own route so Home can be a
 * plain explanation of the app instead, with top-level nav (Debug,
 * Playground, Progress, Admin) living in SiteHeader.
 */
export default function Debug() {
  const [tracks, setTracks] = useState(null)

  useEffect(() => {
    getTracks().then(setTracks)
  }, [])

  if (!tracks) {
    return <p className="debug">Loading tracks…</p>
  }

  return (
    <div className="debug">
      <h1>Pick a track</h1>
      <ul className="debug__tracks">
        {tracks.map((track) => (
          <li key={track.slug} className="debug__track">
            <Link to={`/track/${track.slug}`}>
              <h2>{track.title}</h2>
              <p>{track.summary}</p>
              <span className="debug__track-count">{track.puzzleCount} puzzles</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
