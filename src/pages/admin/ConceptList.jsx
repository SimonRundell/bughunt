import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { adminCreateConcept, adminDeleteConcept, adminListConcepts, adminSaveConcept } from '../../api/admin'

const BLANK = { slug: '', title: '', summary: '', lesson_md: '' }

/**
 * Concept card CRUD (BUILD.md 8), with a live markdown preview since
 * lesson_md follows the fixed 5-part shape (BUILD.md 3.3).
 */
export default function AdminConceptList() {
  const [concepts, setConcepts] = useState(null)
  const [draft, setDraft] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  function reload() {
    adminListConcepts().then(setConcepts)
  }

  useEffect(() => {
    reload()
  }, [])

  if (!concepts) return <p>Loading…</p>

  async function handleSave() {
    if (draft.id) {
      await adminSaveConcept(draft.id, draft)
    } else {
      await adminCreateConcept(draft)
    }
    setDraft(null)
    reload()
  }

  async function handleDelete(id) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    await adminDeleteConcept(id)
    setConfirmId(null)
    reload()
  }

  return (
    <div>
      <div className="admin-toolbar">
        <h1>Concepts</h1>
        <button type="button" className="btn btn--primary" onClick={() => setDraft({ ...BLANK })}>
          New concept
        </button>
      </div>

      {draft && (
        <form className="admin-form admin-form--wide" onSubmit={(e) => { e.preventDefault(); handleSave() }}>
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
          <div className="admin-form__split">
            <label>
              Lesson (markdown - What it is / What it looks like when it goes wrong / How to spot it / How to fix it / Try it)
              <textarea rows={16} value={draft.lesson_md} onChange={(e) => setDraft({ ...draft, lesson_md: e.target.value })} />
            </label>
            <div className="admin-form__preview">
              <ReactMarkdown>{draft.lesson_md}</ReactMarkdown>
            </div>
          </div>
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
            <th></th>
          </tr>
        </thead>
        <tbody>
          {concepts.map((c) => (
            <tr key={c.id}>
              <td>{c.title}</td>
              <td>{c.slug}</td>
              <td>
                <button type="button" className="btn btn--small" onClick={() => setDraft(c)}>
                  Edit
                </button>{' '}
                <button type="button" className="btn btn--small btn--danger" onClick={() => handleDelete(c.id)}>
                  {confirmId === c.id ? 'Confirm' : 'Delete'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
