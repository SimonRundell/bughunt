import { useEffect, useState } from 'react'
import { adminCreateTrack, adminDeleteTrack, adminListTracks, adminSaveTrack } from '../../api/admin'

const BLANK = { slug: '', title: '', summary: '', intro_md: '', bug_focus: 'logic', assist_level: 'full', sort_order: 0, status: 'draft' }

/**
 * Simple track CRUD (BUILD.md 8). Editing happens inline in the list
 * rather than a separate page - tracks have few enough fields that a
 * dedicated editor page would just be ceremony.
 */
export default function AdminTrackList() {
  const [tracks, setTracks] = useState(null)
  const [draft, setDraft] = useState(null) // { id: null } for new, or the track being edited
  const [confirmId, setConfirmId] = useState(null)

  function reload() {
    adminListTracks().then(setTracks)
  }

  useEffect(() => {
    reload()
  }, [])

  if (!tracks) return <p>Loading…</p>

  async function handleSave() {
    if (draft.id) {
      await adminSaveTrack(draft.id, draft)
    } else {
      await adminCreateTrack(draft)
    }
    setDraft(null)
    reload()
  }

  async function handleDelete(id) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    await adminDeleteTrack(id)
    setConfirmId(null)
    reload()
  }

  return (
    <div>
      <div className="admin-toolbar">
        <h1>Tracks</h1>
        <button type="button" className="btn btn--primary" onClick={() => setDraft({ ...BLANK })}>
          New track
        </button>
      </div>

      {draft && (
        <form className="admin-form" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
          <label>
            Slug (lowercase-hyphenated, can't change once created)
            <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} disabled={!!draft.id} required />
          </label>
          <label>
            Title
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
          </label>
          <label>
            Summary
            <input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
          </label>
          <label>
            Intro (markdown)
            <textarea rows={3} value={draft.intro_md ?? ''} onChange={(e) => setDraft({ ...draft, intro_md: e.target.value })} />
          </label>
          <label>
            Bug focus
            <select value={draft.bug_focus} onChange={(e) => setDraft({ ...draft, bug_focus: e.target.value })}>
              <option value="syntax">syntax</option>
              <option value="runtime">runtime</option>
              <option value="logic">logic</option>
              <option value="mixed">mixed</option>
            </select>
          </label>
          <label>
            Assist level
            <select value={draft.assist_level} onChange={(e) => setDraft({ ...draft, assist_level: e.target.value })}>
              <option value="none">none</option>
              <option value="basic">basic</option>
              <option value="full">full</option>
            </select>
          </label>
          <label>
            Sort order
            <input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} />
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
              <option value="draft">draft</option>
              <option value="published">published</option>
            </select>
          </label>
          <div className="admin-form__actions">
            <button type="submit" className="btn btn--primary">Save</button>
            <button type="button" className="btn" onClick={() => setDraft(null)}>Cancel</button>
          </div>
        </form>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Slug</th>
            <th>Bug focus</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>{t.slug}</td>
              <td>{t.bug_focus}</td>
              <td>{t.status}</td>
              <td>
                <button type="button" className="btn btn--small" onClick={() => setDraft(t)}>
                  Edit
                </button>{' '}
                <button type="button" className="btn btn--small btn--danger" onClick={() => handleDelete(t.id)}>
                  {confirmId === t.id ? 'Confirm' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
