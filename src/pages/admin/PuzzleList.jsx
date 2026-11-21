import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminDeletePuzzle, adminExport, adminImport, adminListPuzzles } from '../../api/admin'

/**
 * Puzzle list (BUILD.md 8): filter by track/status/verified, columns for
 * title/track/difficulty/status/verified, delete with confirm. Duplicate
 * and a dedicated filter UI are left for a later pass - noted in
 * PROGRESS.md as a scope simplification given the size of this phase.
 */
export default function AdminPuzzleList() {
  const [puzzles, setPuzzles] = useState(null)
  const [trackFilter, setTrackFilter] = useState('all')
  const [confirmId, setConfirmId] = useState(null)
  const [importMessage, setImportMessage] = useState(null)
  const fileInputRef = useRef(null)

  function reload() {
    adminListPuzzles().then(setPuzzles)
  }

  useEffect(() => {
    reload()
  }, [])

  if (!puzzles) return <p>Loading…</p>

  const tracks = [...new Set(puzzles.map((p) => p.track))]
  const visible = trackFilter === 'all' ? puzzles : puzzles.filter((p) => p.track === trackFilter)

  async function handleDelete(id) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    await adminDeletePuzzle(id)
    setConfirmId(null)
    reload()
  }

  async function handleExport() {
    const text = await adminExport()
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bughunt-export.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportMessage(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const bundle = JSON.parse(String(reader.result))
        const summary = await adminImport(bundle)
        setImportMessage(`Imported ${summary.tracks} tracks, ${summary.concepts} concepts, ${summary.puzzles} puzzles (all as unverified drafts - review and verify before publishing).`)
        reload()
      } catch (err) {
        setImportMessage(err.response?.data?.error?.message ?? 'Import failed - check the file is valid JSON in the expected shape.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div>
      <div className="admin-toolbar">
        <h1>Puzzles</h1>
        <Link to="/admin/puzzles/new" className="btn btn--primary">
          New puzzle
        </Link>
        <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value)} aria-label="Filter by track">
          <option value="all">All tracks</option>
          {tracks.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--small" onClick={handleExport}>
          Export bundle
        </button>
        <button type="button" className="btn btn--small" onClick={() => fileInputRef.current?.click()}>
          Import bundle
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
      </div>
      {importMessage && <p role="status">{importMessage}</p>}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Track</th>
            <th>Difficulty</th>
            <th>Status</th>
            <th>Verified</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <tr key={p.id}>
              <td>
                <Link to={`/admin/puzzles/${p.id}`}>{p.title}</Link>
              </td>
              <td>{p.track}</td>
              <td>{p.difficulty}</td>
              <td>{p.status}</td>
              <td>{p.verified ? '✓' : '—'}</td>
              <td>
                <button type="button" className="btn btn--small btn--danger" onClick={() => handleDelete(p.id)}>
                  {confirmId === p.id ? 'Confirm delete' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
