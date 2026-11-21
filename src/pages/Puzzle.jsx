import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../api/client'
import CodeEditor from '../editor/CodeEditor'
import Console from '../components/Console'
import ErrorExplainer from '../components/ErrorExplainer'
import TestResults from '../components/TestResults'
import DebugLoopStepper from '../components/DebugLoopStepper'
import HintPanel from '../components/HintPanel'
import ExplanationPanel from '../components/ExplanationPanel'
import BadgeToast from '../components/BadgeToast'
import harnessSource from '../python/harness.py?raw'
import { init, interrupt, isInteractiveInputSupported, run, runTests, submitStdinLine } from '../python/runner'
import { getHint, getPuzzle, getPuzzlesForTrack, getSolution } from '../dev/puzzleSource'
import { computeXp, mergeScoringConfig } from '../config/scoring'
import { getPuzzleState, loadProgress, recordGiveUp, recordSolve, saveProgress, updatePuzzleState } from '../store/progress'

/**
 * The puzzle player (BUILD.md 9.2-9.3): brief + Debugging Loop on the
 * left, Monaco in the middle, a Console/Tests/Error Explainer tab set on
 * the right. Diagnose/Trace/Predict are Phase 4 work - the Debugging
 * Loop's "Locate" step has no trigger to tick yet because of that, which
 * is expected, not a bug.
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
  const editorRef = useRef(null)
  const interactiveInput = isInteractiveInputSupported()

  const puzzleState = puzzle ? getPuzzleState(progress, puzzle.slug) : null
  const revealedTiers = puzzleState?.hintsUsed ?? []
  const solved = puzzleState?.solvedAt != null
  const showExplanation = solved || gaveUp

  useEffect(() => {
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

    const loaded = getPuzzle(slug)
    setPuzzle(loaded)
    if (loaded) {
      const freshProgress = loadProgress()
      setProgress(freshProgress)
      const state = getPuzzleState(freshProgress, slug)
      setCode(state.draftCode ?? loaded.buggy_code)
      if (state.solvedAt) {
        setSolution(getSolution(slug))
        setXpAwarded(state.xpAwarded)
      }
    }
  }, [slug])

  useEffect(() => {
    client.get('/public-config.php').then((res) => setAppConfig(res.data.data))
    init({ pyodideUrl: '/pyodide/', harnessSource }).then(() => setStatus('ready'))
  }, [])

  // Autosave the draft, debounced, whenever the code changes.
  useEffect(() => {
    if (!puzzle) return
    const handle = setTimeout(() => {
      setProgress((prev) => {
        const next = updatePuzzleState(prev, puzzle.slug, { draftCode: code })
        saveProgress(next)
        return next
      })
    }, 500)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, puzzle?.slug])

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
    setProgress((prev) => {
      const next = updater(prev)
      saveProgress(next)
      return next
    })
  }

  async function handleRun() {
    setActiveTab('console')
    setLines([])
    setError(null)
    editorRef.current?.setMarkers([])
    setStatus('running')
    setHasRunOrTested(true)

    const inputLines = interactiveInput ? [] : inputLinesDraft.split('\n').filter((l) => l.length > 0)

    const result = await run(code, {
      onStdout: (text) => appendOutput('stdout', text),
      onStderr: (text) => appendOutput('stderr', text),
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
    }
  }

  async function handleRunTests() {
    setActiveTab('tests')
    setHasRunOrTested(true)
    setTestStatus('running')
    setTestResultsByIndex({})
    setRunningTestIndex(null)

    persistProgress((prev) => updatePuzzleState(prev, puzzle.slug, { testRuns: getPuzzleState(prev, puzzle.slug).testRuns + 1 }))

    const results = await runTests(
      code,
      { entryMode: puzzle.entry_mode, entryName: puzzle.entry_name, tests: puzzle.tests },
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
      const xp = computeXp({
        difficulty: puzzle.difficulty,
        xpOverride: puzzle.xp,
        hintTiersUsed: revealedTiers,
        correctDiagnosis: false,
        testRunCount: testRuns,
        gaveUp: false,
        scoring,
      })
      setXpAwarded(xp)
      const badgesBefore = progress.badges
      persistProgress((prev) => {
        const next = recordSolve(prev, {
          slug: puzzle.slug,
          trackSlug: puzzle.track,
          bugType: puzzle.bug_type,
          xpAwarded: xp,
          usedTrace: false,
          trackPuzzleSlugs: getPuzzlesForTrack(puzzle.track).map((p) => p.slug),
        })
        setNewBadges(next.badges.filter((b) => !badgesBefore.includes(b)))
        return next
      })
      setSolution(getSolution(puzzle.slug))
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

  function openTab(tab) {
    setActiveTab(tab)
    if (tab === 'tests' || tab === 'errors') {
      setOpenedResultsTab(true)
    }
  }

  async function handleRevealHint(tier) {
    const hintMd = getHint(puzzle.slug, tier)
    setHintContent((prev) => ({ ...prev, [tier]: hintMd }))
    persistProgress((prev) => {
      const state = getPuzzleState(prev, puzzle.slug)
      if (state.hintsUsed.includes(tier)) return prev
      return updatePuzzleState(prev, puzzle.slug, { hintsUsed: [...state.hintsUsed, tier] })
    })
  }

  function handleGiveUp() {
    if (!showGiveUpConfirm) {
      setShowGiveUpConfirm(true)
      return
    }
    setShowGiveUpConfirm(false)
    setGaveUp(true)
    setXpAwarded(0)
    persistProgress((prev) => recordGiveUp(prev, puzzle.slug))
    setSolution(getSolution(puzzle.slug))
  }

  return (
    <div className="puzzle">
      <header className="puzzle__header">
        <Link to={`/track/${puzzle.track}`}>&larr; {puzzle.track}</Link>
        <h1>{puzzle.title}</h1>
        <span className="puzzle__meta">
          Difficulty {puzzle.difficulty} · {puzzle.bug_type}
        </span>
      </header>

      <div className="puzzle__layout">
        <aside className="puzzle__left">
          <section>
            <h2>Brief</h2>
            <p>{puzzle.brief_md}</p>
          </section>

          <section>
            <h2>Debugging Loop</h2>
            <DebugLoopStepper
              completed={[hasRunOrTested, readStepDone, false, hypothesisNote.trim().length > 0, fixStepDone, allTestsPassed]}
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
        </aside>

        <div className="puzzle__editor">
          <CodeEditor ref={editorRef} value={code} onChange={setCode} />
        </div>

        <div className="puzzle__side">
          <div className="puzzle__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={activeTab === 'console'} onClick={() => openTab('console')}>
              Console
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'tests'} onClick={() => openTab('tests')}>
              Tests
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'errors'} onClick={() => openTab('errors')}>
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
            </>
          )}

          {activeTab === 'tests' && (
            <TestResults tests={puzzle.tests} results={testResultsByIndex} runningIndex={runningTestIndex} status={testStatus} />
          )}

          {activeTab === 'errors' && <ErrorExplainer error={error} />}
        </div>
      </div>

      <div className="puzzle__toolbar">
        <button type="button" onClick={handleRun} disabled={status !== 'ready'}>
          Run
        </button>
        <button type="button" onClick={handleRunTests} disabled={status !== 'ready'}>
          Run tests
        </button>
        <button type="button" onClick={handleStop} disabled={status !== 'running'}>
          Stop
        </button>
        <button type="button" onClick={handleReset}>
          Reset
        </button>
        <button type="button" onClick={handleGiveUp}>
          {showGiveUpConfirm ? 'Really give up? Click again to confirm' : 'Give up'}
        </button>
        <span className="puzzle__status">
          {status === 'loading' && 'Starting Python…'}
          {status === 'restarting' && 'Restarting Python…'}
          {status === 'running' && 'Running…'}
          {status === 'ready' && 'Ready'}
        </span>
      </div>

      <BadgeToast badgeIds={newBadges} onDismiss={() => setNewBadges([])} />

      {showExplanation && solution && (
        <ExplanationPanel solution={solution} studentCode={code} xpAwarded={xpAwarded} gaveUp={gaveUp && !solved} concepts={puzzle.concepts} />
      )}
    </div>
  )
}
