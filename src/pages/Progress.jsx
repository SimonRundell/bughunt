import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import XpBar from '../components/XpBar'
import BadgeIcon from '../components/BadgeIcon'
import { createEmptyProgress, describeBadge, exportProgress, importProgress, loadProgress, saveProgress } from '../store/progress'

/**
 * Progress page (BUILD.md 9.4): XP/rank, earned badges, and the
 * export/import/reset trio students need since there are no accounts -
 * clearing browser data erases progress, and export is the only backup.
 */
export default function Progress() {
  const [progress, setProgress] = useState(() => loadProgress())
  const [importError, setImportError] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileInputRef = useRef(null)

  const solvedCount = Object.values(progress.puzzles).filter((p) => p.solvedAt).length

  function handleExport() {
    const blob = new Blob([exportProgress(progress)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bughunt-progress.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = importProgress(String(reader.result))
      if (!result.ok) {
        setImportError(result.error)
        return
      }
      setProgress(result.progress)
      saveProgress(result.progress)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    const fresh = createEmptyProgress()
    setProgress(fresh)
    saveProgress(fresh)
    setConfirmReset(false)
  }

  return (
    <div className="progress-page">
      <Link to="/" className="btn btn--small back-link">&larr; Home</Link>
      <h1>Your progress</h1>

      <XpBar xp={progress.xp} />
      <p>{solvedCount} puzzle{solvedCount === 1 ? '' : 's'} solved.</p>

      <h2>Badges</h2>
      {progress.badges.length === 0 ? (
        <p>No badges yet - solve a puzzle to earn your first.</p>
      ) : (
        <ul className="progress-page__badges">
          {progress.badges.map((id) => {
            const info = describeBadge(id)
            return (
              <li key={id} className="progress-page__badge">
                <BadgeIcon badgeId={id} size={48} />
                <span>
                  <strong>{info.title}</strong> - {info.description}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <h2>Backup</h2>
      <p>
        Progress lives only in this browser. Clearing your browser data erases it - export a backup first if you
        want to keep it.
      </p>
      <div className="progress-page__actions">
        <button type="button" className="btn btn--primary" onClick={handleExport}>
          Export progress
        </button>
        <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
          Import progress
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        <button type="button" className="btn btn--danger" onClick={handleReset}>
          {confirmReset ? 'Really reset everything? Click again to confirm' : 'Reset progress'}
        </button>
      </div>
      {importError && <p role="alert">{importError}</p>}
    </div>
  )
}
