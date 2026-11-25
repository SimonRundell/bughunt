import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import client from '../api/client'
import CodeEditor from '../editor/CodeEditor'
import Console from '../components/Console'
import ErrorExplainer from '../components/ErrorExplainer'
import TestResults from '../components/TestResults'
import DebugLoopStepper from '../components/DebugLoopStepper'
import HintPanel from '../components/HintPanel'
import ExplanationPanel from '../components/ExplanationPanel'
import BadgeToast from '../components/BadgeToast'
import TraceView from '../components/TraceView'
import harnessSource from '../python/harness.py?raw'
import { init, interrupt, isInteractiveInputSupported, run, runTests, submitStdinLine, traceRun } from '../python/runner'
import { getConceptTitleMap, getHint, getPuzzle, getPuzzlesForTrack, getSolution } from '../api/puzzles'
import { computeXp, mergeScoringConfig } from '../config/scoring'
import { getPuzzleState, loadProgress, recordGiveUp, recordSolve, saveProgress, updatePuzzleState } from '../store/progress'
import { useSettings } from '../hooks/useSettings'
import { fontFamilyStack } from '../store/settings'

/**
 * The puzzle player (BUILD.md 9.2-9.3): brief + Debugging Loop on the
 * left, Monaco in the middle, a Console/Tests/Error Explainer tab set on
 * the right. Diagnose (BUILD.md 3.3) uses the cursor's current line
 * rather than a gutter click - mouse-only gutter interaction would
 * conflict with "fully keyboard operable" (CLAUDE.md), and a button
 * satisfies BUILD.md's "click the gutter, or a button using the cursor
 * line" either/or wording without extra Monaco wiring.
 */
export default function Puzzle() {
  const { slug } = useParams()
  const [puzzle, setPuzzle] = useState(null)
  const [progress, setProgress] = useState(() => loadProgress())
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('loading') // loading | ready | running | restarting
  const [lines, setLines] = useState([])
  const [error, setError] = useState(null)
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [inputLinesDraft, setInputLinesDraft] = useState('')
  const [appConfig, setAppConfig] = useState(null)
  const [activeTab, setActiveTab] = useState('console')
  const [hasRunOrTested, setHasRunOrTested] = useState(false)
  const [lastRunFailed, setLastRunFailed] = useState(false)
  const [ranSilently, setRanSilently] = useState(false)
  const [openedResultsTab, setOpenedResultsTab] = useState(false)
  const [hypothesisNote, setHypothesisNote] = useState('')
  const [testStatus, setTestStatus] = useState('idle') // idle | running | done
  const [testResultsByIndex, setTestResultsByIndex] = useState({})
  const [runningTestIndex, setRunningTestIndex] = useState(null)
  const [allTestsPassed, setAllTestsPassed] = useState(false)
  const [hintContent, setHintContent] = useState({})
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false)
  const [solution, setSolution] = useState(null)
  const [gaveUp, setGaveUp] = useState(false)
  const [xpAwarded, setXpAwarded] = useState(0)
  const [newBadges, setNewBadges] = useState([])
  const [conceptTitles, setConceptTitles] = useState(new Map())
  const [diagnoseDraft, setDiagnoseDraft] = useState(null) // { line, type } while the picker is open, not yet confirmed
  const [predictionText, setPredictionText] = useState('')
  const [traceResult, setTraceResult] = useState(null)
  const [traceStatus, setTraceStatus] = useState('idle') // idle | running
  const editorRef = useRef(null)
  const interactiveInput = isInteractiveInputSupported()
  const settings = useSettings()

  const puzzleState = puzzle ? getPuzzleState(progress, puzzle.slug) : null
  const revealedTiers = puzzleState?.hintsUsed ?? []
  const solved = puzzleState?.solvedAt != null
  const showExplanation = solved || gaveUp

  useEffect(() => {
    let cancelled = false
    setPuzzle(null)
    setSolution(null)
    setGaveUp(false)
    setAllTestsPassed(false)
    setHintContent({})
    setTestResultsByIndex({})
    setTestStatus('idle')
    setHasRunOrTested(false)
    setLastRunFailed(false)
    setOpenedResultsTab(false)
    setHypothesisNote('')
    setLines([])
    setError(null)
    setDiagnoseDraft(null)
    setPredictionText('')
    setTraceResult(null)
    setTraceStatus('idle')

    getPuzzle(slug).then(async (loaded) => {
      if (cancelled || !loaded) return
      setPuzzle(loaded)
      const freshProgress = loadProgress()
      setProgress(freshProgress)
      const state = getPuzzleState(freshProgress, slug)
      setCode(state.draftCode ?? loaded.buggy_code)
      if (state.solvedAt) {
        setXpAwarded(state.xpAwarded)
        const sol = await getSolution(slug)
        if (!cancelled) setSolution(sol)
      }
    })

    return () => {
      cancelled = true
    }
  }, [slug])

  useEffect(() => {
    client.get('/public-config.php').then((res) => setAppConfig(res.data.data))
    init({ pyodideUrl: '/pyodide/', harnessSource }).then(() => setStatus('ready'))
    getConceptTitleMap().then(setConceptTitles)
  }, [])

  // Autosave the draft, debounced, whenever the code changes.
  useEffect(() => {
    if (!puzzle) return
    const handle = setTimeout(() => {
      setProgress((prev) => updatePuzzleState(prev, puzzle.slug, { draftCode: code }))
    }, 500)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, puzzle?.slug])

  // Persists to localStorage whenever progress state changes. Kept out of
  // the setState updaters above/below: React may invoke an updater more
  // than once (e.g. StrictMode), so side effects (the localStorage write,
  // and the window event it dispatches for SiteHeader) don't belong there.
  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  if (!puzzle) {
    return <p>Loading puzzle…</p>
  }

  const scoring = mergeScoringConfig(appConfig?.scoring)
  const fixStepDone = code !== puzzle.buggy_code
  const readStepDone = lastRunFailed && openedResultsTab

  function appendOutput(type, text) {
    setLines((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.type === type) {
        return [...prev.slice(0, -1), { type, text: last.text + text }]
      }
      return [...prev, { type, text }]
    })
  }

  function persistProgress(updater) {
    setProgress((prev) => updater(prev))
  }

  async function handleRun() {
    setActiveTab('console')
    setLines([])
    setError(null)
    setRanSilently(false)
    editorRef.current?.setMarkers([])
    setStatus('running')
    setHasRunOrTested(true)

    const inputLines = interactiveInput ? [] : inputLinesDraft.split('\n').filter((l) => l.length > 0)
    let producedOutput = false

    const result = await run(code, {
      onStdout: (text) => {
        producedOutput = true
        appendOutput('stdout', text)
      },
      onStderr: (text) => {
        producedOutput = true
        appendOutput('stderr', text)
      },
      onStdinRequest: () => setAwaitingInput(true),
      onRestarting: () => setStatus('restarting'),
      inputLines,
      timeoutMs: appConfig?.runTimeoutMs ?? 5000,
      maxOutputChars: appConfig?.maxOutputChars ?? 20000,
    })

    setAwaitingInput(false)
    setStatus('ready')

    if (!result.ok) {
      setError(result.error)
      setLastRunFailed(true)
      if (result.error.line) {
        editorRef.current?.setMarkers([
          {
            startLineNumber: result.error.line,
            endLineNumber: result.error.line,
            startColumn: 1,
            endColumn: 1000,
            message: `${result.error.type}: ${result.error.message}`,
            severity: 8,
          },
        ])
      }
    } else {
      setLastRunFailed(false)
      // A function-mode puzzle's buggy code is just a `def` - running it
      // as a plain script never calls the function, so it can succeed
      // with zero output and zero error. Without this, "Run" looks like
      // it silently did nothing, with no clue that "Run tests" (which
      // actually calls the function) is the next step.
      if (!producedOutput && puzzle.entry_mode === 'function') {
        setRanSilently(true)
      }
    }
  }

  async function handleRunTests() {
    setActiveTab('tests')
    setHasRunOrTested(true)
    setRanSilently(false)
    setTestStatus('running')
    setTestResultsByIndex({})
    setRunningTestIndex(null)

    persistProgress((prev) => updatePuzzleState(prev, puzzle.slug, { testRuns: getPuzzleState(prev, puzzle.slug).testRuns + 1 }))

    const results = await runTests(
      code,
      { entryMode: puzzle.entry_mode, entryName: puzzle.entry_name, tests: puzzle.tests, slug: puzzle.slug },
      {
        onTestStart: (index) => setRunningTestIndex(index),
        onTestResult: (result) => setTestResultsByIndex((prev) => ({ ...prev, [result.index]: result })),
      },
      appConfig?.runTimeoutMs ?? 5000,
    )

    setTestStatus('done')
    setRunningTestIndex(null)
    const allPassed = results.length > 0 && results.every((r) => r.passed)
    setAllTestsPassed(allPassed)
    setLastRunFailed(!allPassed)

    if (allPassed && !solved) {
      const testRuns = getPuzzleState(progress, puzzle.slug).testRuns + 1
      const sol = await getSolution(puzzle.slug)
      const diagnosis = getPuzzleState(progress, puzzle.slug).diagnosis
      const usedTrace = getPuzzleState(progress, puzzle.slug).usedTrace
      const correctDiagnosis =
        diagnosis.line !== null &&
        diagnosis.type !== null &&
        sol.bugs.some((b) => diagnosis.line >= b.line_start && diagnosis.line <= b.line_end && b.bug_type === diagnosis.type)

      const xp = computeXp({
        difficulty: puzzle.difficulty,
        xpOverride: puzzle.xp,
        hintTiersUsed: revealedTiers,
        correctDiagnosis,
        testRunCount: testRuns,
        gaveUp: false,
        scoring,
      })
      setXpAwarded(xp)
      const trackPuzzles = await getPuzzlesForTrack(puzzle.track)
      let nextProgress = recordSolve(progress, {
        slug: puzzle.slug,
        trackSlug: puzzle.track,
        bugType: puzzle.bug_type,
        xpAwarded: xp,
        usedTrace,
        trackPuzzleSlugs: trackPuzzles.map((p) => p.slug),
      })
      if (diagnosis.line !== null) {
        nextProgress = updatePuzzleState(nextProgress, puzzle.slug, { diagnosis: { ...diagnosis, correct: correctDiagnosis } })
      }
      setNewBadges(nextProgress.badges.filter((b) => !progress.badges.includes(b)))
      setProgress(nextProgress)
      setSolution(sol)
    }
  }

  function handleSubmitInput(text) {
    appendOutput('stdout', `${text}\n`)
    submitStdinLine(text)
    setAwaitingInput(false)
  }

  function handleStop() {
    interrupt()
  }

  function handleReset() {
    setCode(puzzle.buggy_code)
  }

  function handleFlagLine() {
    const line = editorRef.current?.getCursorLine() ?? 1
    setDiagnoseDraft({ line, type: 'syntax' })
  }

  function handleConfirmDiagnosis() {
    persistProgress((prev) =>
      updatePuzzleState(prev, puzzle.slug, { diagnosis: { line: diagnoseDraft.line, type: diagnoseDraft.type, correct: null } }),
    )
    setDiagnoseDraft(null)
  }

  async function handleTrace(test = null) {
    setActiveTab('trace')
    setTraceStatus('running')
    const result = await traceRun(
      code,
      { entryMode: puzzle.entry_mode, entryName: puzzle.entry_name, test },
      appConfig?.runTimeoutMs ?? 5000,
    )
    setTraceStatus('idle')
    setTraceResult(result)
    persistProgress((prev) => updatePuzzleState(prev, puzzle.slug, { usedTrace: true }))
  }

  function handleCancelDiagnosis() {
    setDiagnoseDraft(null)
  }

  function openTab(tab) {
    setActiveTab(tab)
    if (tab === 'tests' || tab === 'errors') {
      setOpenedResultsTab(true)
    }
  }

  async function handleRevealHint(tier) {
    const hintMd = await getHint(puzzle.slug, tier)
    setHintContent((prev) => ({ ...prev, [tier]: hintMd }))
    persistProgress((prev) => {
      const state = getPuzzleState(prev, puzzle.slug)
      if (state.hintsUsed.includes(tier)) return prev
      return updatePuzzleState(prev, puzzle.slug, { hintsUsed: [...state.hintsUsed, tier] })
    })
  }

  async function handleGiveUp() {
    if (!showGiveUpConfirm) {
      setShowGiveUpConfirm(true)
      return
    }
    setShowGiveUpConfirm(false)
    setGaveUp(true)
    setXpAwarded(0)
    persistProgress((prev) => recordGiveUp(prev, puzzle.slug))
    setSolution(await getSolution(puzzle.slug))
  }

  return (
    <div className="puzzle">
      <header className="puzzle__header">
        <Link to={`/track/${puzzle.track}`} className="btn btn--small back-link">&larr; {puzzle.track}</Link>
        <h1>{puzzle.title}</h1>
        <span className="puzzle__meta">
          Difficulty {puzzle.difficulty} · {puzzle.bug_type}
        </span>
      </header>

      <div className="puzzle__toolbar">
        <button type="button" className="btn btn--primary" onClick={handleRun} disabled={status !== 'ready'}>
          Run
        </button>
        <button type="button" className="btn" onClick={handleRunTests} disabled={status !== 'ready'}>
          Run tests
        </button>
        <button type="button" className="btn" onClick={() => handleTrace(null)} disabled={status !== 'ready' || traceStatus === 'running'}>
          Trace
        </button>
        <button type="button" className="btn" onClick={handleStop} disabled={status !== 'running'}>
          Stop
        </button>
        <button type="button" className="btn" onClick={handleReset}>
          Reset
        </button>
        <button type="button" className="btn" onClick={handleFlagLine} disabled={status !== 'ready' || solved}>
          Flag suspect line
        </button>
        <button type="button" className="btn btn--danger" onClick={handleGiveUp}>
          {showGiveUpConfirm ? 'Really give up? Click again to confirm' : 'Give up'}
        </button>
        <span className="puzzle__status">
          {status === 'loading' && 'Starting Python…'}
          {status === 'restarting' && 'Restarting Python…'}
          {status === 'running' && 'Running…'}
          {status === 'ready' && 'Ready'}
        </span>
      </div>

      <p className="editor-a11y-hint">
        Keyboard: Tab indents inside the editor. Press Ctrl+M (Ctrl+Shift+M on Mac) to make Tab move focus out instead.
      </p>

      {diagnoseDraft && (
        <div className="puzzle__diagnose-picker">
          <span>Line {diagnoseDraft.line} is:</span>
          <select value={diagnoseDraft.type} onChange={(e) => setDiagnoseDraft({ ...diagnoseDraft, type: e.target.value })} aria-label="Bug type">
            <option value="syntax">syntax</option>
            <option value="runtime">runtime</option>
            <option value="logic">logic</option>
          </select>
          <button type="button" className="btn btn--small btn--primary" onClick={handleConfirmDiagnosis}>
            Confirm
          </button>
          <button type="button" className="btn btn--small" onClick={handleCancelDiagnosis}>
            Cancel
          </button>
        </div>
      )}
      {!diagnoseDraft && puzzleState.diagnosis.line !== null && (
        <p className="puzzle__diagnose-status">
          Diagnosis: line {puzzleState.diagnosis.line} ({puzzleState.diagnosis.type})
          {puzzleState.diagnosis.correct === true && ' - correct!'}
          {puzzleState.diagnosis.correct === false && ' - not quite, see the explanation once you solve it'}
        </p>
      )}

      <div className="puzzle__layout">
        <aside className="puzzle__left">
          <section>
            <h2>Brief</h2>
            <ReactMarkdown>{puzzle.brief_md}</ReactMarkdown>
          </section>

          {puzzle.predict_prompt_md && (
            <section>
              <h2>Predict</h2>
              {!hasRunOrTested ? (
                <>
                  <ReactMarkdown>{puzzle.predict_prompt_md}</ReactMarkdown>
                  <label htmlFor="prediction">Your prediction</label>
                  <textarea id="prediction" rows={2} value={predictionText} onChange={(e) => setPredictionText(e.target.value)} />
                </>
              ) : predictionText.trim() ? (
                <p className="puzzle__prediction-recap">
                  Your prediction: <em>{predictionText}</em> - did it match what actually happened?
                </p>
              ) : (
                <p className="puzzle__prediction-recap">You ran the code before writing a prediction - try that first next time.</p>
              )}
            </section>
          )}

          <section>
            <h2>Debugging Loop</h2>
            <DebugLoopStepper
              completed={[hasRunOrTested, readStepDone, puzzleState.diagnosis.line !== null, hypothesisNote.trim().length > 0, fixStepDone, allTestsPassed]}
            />
          </section>

          <section>
            <label htmlFor="hypothesis">What do you think is wrong? (optional)</label>
            <textarea
              id="hypothesis"
              rows={2}
              value={hypothesisNote}
              onChange={(e) => setHypothesisNote(e.target.value)}
            />
          </section>

          <section>
            <h2>Hints</h2>
            <HintPanel
              hintCount={puzzle.hint_count}
              revealedTiers={revealedTiers}
              hintContent={hintContent}
              onReveal={handleRevealHint}
            />
          </section>

          {puzzle.concepts.length > 0 && (
            <section>
              <h2>Concepts</h2>
              <ul className="puzzle__concepts">
                {puzzle.concepts.map((slug) => (
                  <li key={slug}>
                    <Link to={`/concepts/${slug}`}>{conceptTitles.get(slug) ?? slug}</Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <div className="puzzle__editor">
          <CodeEditor
            ref={editorRef}
            value={code}
            onChange={setCode}
            fontSize={settings.editorFontSize}
            fontFamily={fontFamilyStack(settings.editorFontFamily)}
            lineNumbers={settings.showLineNumbers}
          />
        </div>

        <div className="puzzle__side">
          <div className="puzzle__tabs" role="tablist">
            <button type="button" className="tab-button" role="tab" aria-selected={activeTab === 'console'} onClick={() => openTab('console')}>
              Console
            </button>
            <button type="button" className="tab-button" role="tab" aria-selected={activeTab === 'tests'} onClick={() => openTab('tests')}>
              Tests
            </button>
            <button type="button" className="tab-button" role="tab" aria-selected={activeTab === 'trace'} onClick={() => openTab('trace')}>
              Trace
            </button>
            <button type="button" className="tab-button" role="tab" aria-selected={activeTab === 'errors'} onClick={() => openTab('errors')}>
              Error Explainer
            </button>
          </div>

          {activeTab === 'console' && (
            <>
              {!interactiveInput && (
                <div className="playground__inputs">
                  <label htmlFor="pz-inputs">Inputs (one per line)</label>
                  <textarea id="pz-inputs" value={inputLinesDraft} onChange={(e) => setInputLinesDraft(e.target.value)} rows={3} />
                </div>
              )}
              <Console lines={lines} awaitingInput={awaitingInput} onSubmitInput={handleSubmitInput} />
              {error && (
                <p className="puzzle__next-step">
                  That's an error. Click <strong>Error Explainer</strong> above to see what it means.
                </p>
              )}
              {ranSilently && (
                <p className="puzzle__next-step">
                  No output and no error - that's expected here. This puzzle is a function, and defining a function
                  doesn't run it. Click <strong>Run tests</strong> to actually call it and see what happens.
                </p>
              )}
            </>
          )}

          {activeTab === 'tests' && (
            <TestResults tests={puzzle.tests} results={testResultsByIndex} runningIndex={runningTestIndex} status={testStatus} onTraceTest={handleTrace} />
          )}

          {activeTab === 'trace' && <TraceView trace={traceResult} status={traceStatus} editorRef={editorRef} />}

          {activeTab === 'errors' && <ErrorExplainer error={error} />}
        </div>
      </div>

      <BadgeToast badgeIds={newBadges} onDismiss={() => setNewBadges([])} />

      {showExplanation && solution && (
        <ExplanationPanel solution={solution} studentCode={code} xpAwarded={xpAwarded} gaveUp={gaveUp && !solved} concepts={puzzle.concepts} />
      )}
    </div>
  )
}
