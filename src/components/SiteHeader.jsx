import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { loadProgress, PROGRESS_CHANGED_EVENT } from '../store/progress'
import XpBar from './XpBar'
import SettingsPanel from './SettingsPanel'

/**
 * Persistent brand bar shown on every page: logo, title (links back to
 * `/`), top-level nav (Debug/Playground/Concepts/Progress/Admin), the XP
 * bar, and a Settings toggle (BUILD.md 9.2 places Settings in this same
 * header, alongside the XP bar and rank). Mounted once in App.jsx rather
 * than per-page, so its XP figure re-reads progress on
 * `PROGRESS_CHANGED_EVENT` (dispatched by `saveProgress`) instead of
 * going stale between page navigations.
 */
export default function SiteHeader() {
  const [progress, setProgress] = useState(() => loadProgress())
  const [settingsOpen, setSettingsOpen] = useState(false)

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
      <nav className="site-header__nav" aria-label="Main">
        <NavLink to="/debug" className={({ isActive }) => (isActive ? 'active' : '')}>
          Debug
        </NavLink>
        <NavLink to="/playground" className={({ isActive }) => (isActive ? 'active' : '')}>
          Playground
        </NavLink>
        <NavLink to="/concepts" className={({ isActive }) => (isActive ? 'active' : '')}>
          Concepts
        </NavLink>
        <NavLink to="/progress" className={({ isActive }) => (isActive ? 'active' : '')}>
          Progress
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
          Admin
        </NavLink>
      </nav>
      <XpBar xp={progress.xp} />
      <button type="button" className="btn btn--small site-header__settings-toggle" onClick={() => setSettingsOpen((open) => !open)}>
        Settings
      </button>
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </header>
  )
}
