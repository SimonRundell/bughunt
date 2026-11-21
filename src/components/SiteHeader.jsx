import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadProgress, PROGRESS_CHANGED_EVENT } from '../store/progress'
import XpBar from './XpBar'

/**
 * Persistent brand bar shown on every page: logo, title (links back to
 * `/`) and the XP bar. Mounted once in App.jsx rather than per-page, so
 * its XP figure re-reads progress on `PROGRESS_CHANGED_EVENT` (dispatched
 * by `saveProgress`) instead of going stale between page navigations.
 */
export default function SiteHeader() {
  const [progress, setProgress] = useState(() => loadProgress())

  useEffect(() => {
    const onProgressChanged = () => setProgress(loadProgress())
    window.addEventListener(PROGRESS_CHANGED_EVENT, onProgressChanged)
    return () => window.removeEventListener(PROGRESS_CHANGED_EVENT, onProgressChanged)
  }, [])

  return (
    <header className="site-header">
      <Link to="/" className="site-header__brand">
        <img src="/favicon.png" alt="BugHunt logo" className="site-header__logo" />
        <h1>BugHunt</h1>
      </Link>
      <XpBar xp={progress.xp} />
    </header>
  )
}
