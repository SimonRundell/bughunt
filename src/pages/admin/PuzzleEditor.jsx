import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DiffEditor, Editor } from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import { setupMonaco } from '../../editor/monacoSetup'
import { adminCreatePuzzle, adminGetPuzzle, adminListConcepts, adminListTracks, adminSavePuzzle, adminVerifyPuzzle } from '../../api/admin'

setupMonaco()

const BLANK_TEST = { label: '', args_py: '', kwargs_py: '', stdin_text: '', expect_kind: 'returns', expect_py: '', compare_mode: 'exact', hidden: false }
const BLANK_HINT = (tier) => ({ tier, hint_md: '' })
const BLANK_BUG = { line_start: 1, line_end: 1, bug_type: 'logic', concept: '', what_md: '', fix_md: '' }

/**
 * Puzzle editor (BUILD.md 8), simplified from the full rich spec given
 * this phase's overall size:
 * - Bug line ranges are plain number inputs, not gutter click-to-select.
 * - Tests are added/removed/reordered with buttons, no drag-and-drop, and
 *   there's no "capture from fixed code" auto-fill helper.
 * - No "preview as student" mode yet.
 * All noted in PROGRESS.md as follow-ups, not forgotten.
 */
export default function AdminPuzzleEditor() {
  const { id } = useParams()
  const isNew = id === undefined
  const navigate = useNavigate()

  const [tracks, setTracks] = useState([])
  const [concepts, setConcepts] = useState([])
  const [puzzle, setPuzzle] = useState(null)
  const [showDiff, setShowDiff] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    adminListTracks().then(setTracks)
    adminListConcepts().then(setConcepts)
  }, [])

  useEffect(() => {
    if (isNew) {
      setPuzzle({
        slug: '', track: '', title: '', difficulty: 1, xp: '', bug_type: 'logic',
        brief_md: '', buggy_code: '', fixed_code: '', entry_mode: 'function', entry_name: '',
        explanation_md: '', spot_it_md: '', predict_prompt_md: '', status: 'draft', verified: false,
        tests: [{ ...BLANK_TEST }], hints: [1, 2, 3].map(BLANK_HINT), bugs: [], concepts: [],
      })
      return
    }
    adminGetPuzzle(id).then((p) => {
      setPuzzle({
        ...p,
        track: p.track_slug,
        xp: p.xp ?? '',
        hints: [1, 2, 3].map((tier) => p.hints.find((h) => h.tier === tier) ?? BLANK_HINT(tier)),
      })
    })
  }, [id, isNew])

  if (!puzzle) return <p>Loading…</p>

  function update(patch) {
    setPuzzle((prev) => ({ ...prev, ...patch }))
  }

  function updateTest(i, patch) {
    const tests = [...puzzle.tests]
    tests[i] = { ...tests[i], ...patch }
    update({ tests })
  }
  function addTest() {
    update({ tests: [...puzzle.tests, { ...BLANK_TEST }] })
  }
  function removeTest(i) {
    update({ tests: puzzle.tests.filter((_, idx) => idx !== i) })
  }

  function updateBug(i, patch) {
    const bugs = [...puzzle.bugs]
    bugs[i] = { ...bugs[i], ...patch }
    update({ bugs })
  }
  function addBug() {
    update({ bugs: [...puzzle.bugs, { ...BLANK_BUG }] })
  }
  function removeBug(i) {
    update({ bugs: puzzle.bugs.filter((_, idx) => idx !== i) })
  }

  function toggleConcept(slug) {
    const has = puzzle.concepts.includes(slug)
    update({ concepts: has ? puzzle.concepts.filter((s) => s !== slug) : [...puzzle.concepts, slug] })
  }

  async function handleSave(publish) {
    setSaving(true)
    setMessage(null)
    try {
      const payload = { ...puzzle, status: publish ? 'published' : 'draft', hints: puzzle.hints.filter((h) => h.hint_md.trim() !== '') }
      if (isNew) {
        const created = await adminCreatePuzzle(payload)
        navigate(`/admin/puzzles/${created.id}`, { replace: true })
        return
      }
      await adminSavePuzzle(id, payload)
      const fresh = await adminGetPuzzle(id)
      setPuzzle({ ...fresh, track: fresh.track_slug, xp: fresh.xp ?? '', hints: [1, 2, 3].map((tier) => fresh.hints.find((h) => h.tier === tier) ?? BLANK_HINT(tier)) })
      setMessage(publish ? 'Saved and published.' : 'Saved as draft.')
    } catch (err) {
      setMessage(err.response?.data?.error?.message ?? 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleVerify() {
    setSaving(true)
    setMessage(null)
    try {
      await adminVerifyPuzzle(id)
      const fresh = await adminGetPuzzle(id)
      setPuzzle((prev) => ({ ...prev, verified: fresh.verified, verified_hash: fresh.verified_hash }))
      setMessage('Verified. You can publish it now.')
    } catch (err) {
      setMessage(err.response?.data?.error?.message ?? 'Verification failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-puzzle-editor">
      <div className="admin-toolbar">
        <h1>{isNew ? 'New puzzle' : puzzle.title || puzzle.slug}</h1>
        <span>{puzzle.verified ? '✓ Verified' : 'Not verified'}</span>
        {!isNew && (
          <button type="button" className="btn" onClick={handleVerify} disabled={saving}>
            Verify
          </button>
        )}
        <button type="button" className="btn" onClick={() => handleSave(false)} disabled={saving}>
          Save draft
        </button>
        <button type="button" className="btn btn--primary" onClick={() => handleSave(true)} disabled={saving || !puzzle.verified}>
          Save &amp; publish
        </button>
      </div>
      {message && <p role="status">{message}</p>}

      <section className="admin-form">
        <h2>Metadata</h2>
        <label>
          Slug {!isNew && '(fixed)'}
          <input value={puzzle.slug} onChange={(e) => update({ slug: e.target.value })} disabled={!isNew} required />
        </label>
        <label>
          Title
          <input value={puzzle.title} onChange={(e) => update({ title: e.target.value })} required />
        </label>
        <label>
          Track
          <select value={puzzle.track} onChange={(e) => update({ track: e.target.value })} required>
            <option value="">Choose a track…</option>
            {tracks.map((t) => (
              <option key={t.slug} value={t.slug}>{t.title}</option>
            ))}
          </select>
        </label>
        <label>
          Difficulty (1-5)
          <input type="number" min={1} max={5} value={puzzle.difficulty} onChange={(e) => update({ difficulty: Number(e.target.value) })} />
        </label>
        <label>
          XP override (blank = use difficulty default)
          <input type="number" value={puzzle.xp} onChange={(e) => update({ xp: e.target.value })} />
        </label>
        <label>
          Bug type
          <select value={puzzle.bug_type} onChange={(e) => update({ bug_type: e.target.value })}>
            <option value="syntax">syntax</option>
            <option value="runtime">runtime</option>
            <option value="logic">logic</option>
            <option value="mixed">mixed</option>
          </select>
        </label>
        <label>
          Entry mode
          <select value={puzzle.entry_mode} onChange={(e) => update({ entry_mode: e.target.value })}>
            <option value="function">function</option>
            <option value="script">script</option>
          </select>
        </label>
        {puzzle.entry_mode === 'function' && (
          <label>
            Entry function name
            <input value={puzzle.entry_name ?? ''} onChange={(e) => update({ entry_name: e.target.value })} />
          </label>
        )}
      </section>

      <section className="admin-form admin-form--wide">
        <h2>Brief</h2>
        <div className="admin-form__split">
          <label>
            Brief (markdown)
            <textarea rows={6} value={puzzle.brief_md} onChange={(e) => update({ brief_md: e.target.value })} />
          </label>
          <div className="admin-form__preview">
            <ReactMarkdown>{puzzle.brief_md}</ReactMarkdown>
          </div>
        </div>
        <label>
          Predict prompt (optional, markdown)
          <textarea rows={2} value={puzzle.predict_prompt_md ?? ''} onChange={(e) => update({ predict_prompt_md: e.target.value })} />
        </label>
      </section>

      <section>
        <div className="admin-toolbar">
          <h2>Code</h2>
          <button type="button" className="btn btn--small" onClick={() => setShowDiff((v) => !v)}>
            {showDiff ? 'Show side by side' : 'Show diff'}
          </button>
        </div>
        {showDiff ? (
          <div className="admin-code-pane">
            <DiffEditor
              height="300px"
              language="python"
              theme="vs-dark"
              original={puzzle.buggy_code}
              modified={puzzle.fixed_code}
              options={{ readOnly: true, renderSideBySide: true, fontFamily: "'Courier New', monospace", automaticLayout: true }}
            />
          </div>
        ) : (
          <div className="admin-code-pane admin-code-pane--split">
            <div>
              <h3>Buggy code</h3>
              <Editor
                height="300px"
                language="python"
                theme="vs-dark"
                value={puzzle.buggy_code}
                onChange={(v) => update({ buggy_code: v ?? '' })}
                options={{ fontFamily: "'Courier New', monospace", automaticLayout: true, minimap: { enabled: false } }}
              />
            </div>
            <div>
              <h3>Fixed code</h3>
              <Editor
                height="300px"
                language="python"
                theme="vs-dark"
                value={puzzle.fixed_code}
                onChange={(v) => update({ fixed_code: v ?? '' })}
                options={{ fontFamily: "'Courier New', monospace", automaticLayout: true, minimap: { enabled: false } }}
              />
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="admin-toolbar">
          <h2>Bugs</h2>
          <button type="button" className="btn btn--small" onClick={addBug}>Add bug</button>
        </div>
        {puzzle.bugs.map((b, i) => (
          <div key={i} className="admin-bug-row">
            <label>
              Line start
              <input type="number" min={1} value={b.line_start} onChange={(e) => updateBug(i, { line_start: Number(e.target.value) })} />
            </label>
            <label>
              Line end
              <input type="number" min={1} value={b.line_end} onChange={(e) => updateBug(i, { line_end: Number(e.target.value) })} />
            </label>
            <label>
              Type
              <select value={b.bug_type} onChange={(e) => updateBug(i, { bug_type: e.target.value })}>
                <option value="syntax">syntax</option>
                <option value="runtime">runtime</option>
                <option value="logic">logic</option>
              </select>
            </label>
            <label>
              Concept
              <select value={b.concept ?? ''} onChange={(e) => updateBug(i, { concept: e.target.value })}>
                <option value="">(none)</option>
                {concepts.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.title}</option>
                ))}
              </select>
            </label>
            <label>
              What (markdown)
              <textarea rows={2} value={b.what_md} onChange={(e) => updateBug(i, { what_md: e.target.value })} />
            </label>
            <label>
              Fix (markdown)
              <textarea rows={2} value={b.fix_md} onChange={(e) => updateBug(i, { fix_md: e.target.value })} />
            </label>
            <button type="button" className="btn btn--small btn--danger" onClick={() => removeBug(i)}>Remove</button>
          </div>
        ))}
      </section>

      <section>
        <div className="admin-toolbar">
          <h2>Tests</h2>
          <button type="button" className="btn btn--small" onClick={addTest}>Add test</button>
        </div>
        {puzzle.tests.map((t, i) => (
          <div key={i} className="admin-test-row">
            <label>
              Label
              <input value={t.label} onChange={(e) => updateTest(i, { label: e.target.value })} />
            </label>
            {puzzle.entry_mode === 'function' ? (
              <>
                <label>
                  args_py
                  <input value={t.args_py ?? ''} onChange={(e) => updateTest(i, { args_py: e.target.value })} placeholder="(4,)" />
                </label>
                <label>
                  kwargs_py
                  <input value={t.kwargs_py ?? ''} onChange={(e) => updateTest(i, { kwargs_py: e.target.value })} placeholder="{}" />
                </label>
              </>
            ) : (
              <label>
                stdin_text
                <input value={t.stdin_text ?? ''} onChange={(e) => updateTest(i, { stdin_text: e.target.value })} />
              </label>
            )}
            <label>
              Expect kind
              <select value={t.expect_kind} onChange={(e) => updateTest(i, { expect_kind: e.target.value })}>
                <option value="returns">returns</option>
                <option value="stdout">stdout</option>
                <option value="raises">raises</option>
              </select>
            </label>
            <label>
              Expect (Python literal, or exception name for "raises")
              <input value={t.expect_py} onChange={(e) => updateTest(i, { expect_py: e.target.value })} />
            </label>
            <label>
              Compare mode
              <select value={t.compare_mode} onChange={(e) => updateTest(i, { compare_mode: e.target.value })}>
                <option value="exact">exact</option>
                <option value="float_tol">float_tol</option>
                <option value="trim_stdout">trim_stdout</option>
                <option value="exact_stdout">exact_stdout</option>
              </select>
            </label>
            <label className="admin-checkbox">
              <input type="checkbox" checked={t.hidden} onChange={(e) => updateTest(i, { hidden: e.target.checked })} />
              Hidden
            </label>
            <button type="button" className="btn btn--small btn--danger" onClick={() => removeTest(i)}>Remove</button>
          </div>
        ))}
      </section>

      <section className="admin-form admin-form--wide">
        <h2>Hints</h2>
        {puzzle.hints.map((h, i) => (
          <label key={h.tier}>
            Tier {h.tier}
            <textarea rows={2} value={h.hint_md} onChange={(e) => { const hints = [...puzzle.hints]; hints[i] = { ...h, hint_md: e.target.value }; update({ hints }) }} />
          </label>
        ))}
      </section>

      <section className="admin-form admin-form--wide">
        <h2>Explanation</h2>
        <label>
          Explanation (markdown)
          <textarea rows={4} value={puzzle.explanation_md} onChange={(e) => update({ explanation_md: e.target.value })} />
        </label>
        <label>
          Spot it next time (markdown)
          <textarea rows={2} value={puzzle.spot_it_md ?? ''} onChange={(e) => update({ spot_it_md: e.target.value })} />
        </label>
      </section>

      <section>
        <h2>Concepts</h2>
        <div className="admin-concept-grid">
          {concepts.map((c) => (
            <label key={c.slug} className="admin-checkbox">
              <input type="checkbox" checked={puzzle.concepts.includes(c.slug)} onChange={() => toggleConcept(c.slug)} />
              {c.title}
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}
