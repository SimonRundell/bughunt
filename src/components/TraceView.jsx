import { useEffect, useRef, useState } from 'react'

const AUTO_PLAY_MS = 700

/**
 * Trace tab (BUILD.md 4.6/3.3): step forward/back or auto-play through a
 * traced run, a variable watch for the current step (changed values
 * flash - respects `prefers-reduced-motion` via the global animation
 * kill-switch in index.css), and a trace table (one row per executed
 * line, one column per variable) that copies as tab-separated text.
 *
 * @param {object} props
 * @param {{ok: boolean, error: object|null, steps: object[], stdout: string, truncated: boolean}|null} props.trace
 * @param {'idle'|'running'} props.status
 * @param {import('react').RefObject} props.editorRef - CodeEditor ref, for the current-line highlight
 */
export default function TraceView({ trace, status, editorRef }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playTimerRef = useRef(null)

  const steps = trace?.steps ?? []
  const currentStep = steps[stepIndex] ?? null
  const previousStep = stepIndex > 0 ? steps[stepIndex - 1] : null

  // A fresh trace result always starts review from the first step.
  useEffect(() => {
    setStepIndex(0)
    setPlaying(false)
  }, [trace])

  // Keep the editor's current-line marker in sync, clear it on unmount
  // (e.g. switching away from this tab) so it doesn't linger.
  useEffect(() => {
    const editor = editorRef.current
    editor?.highlightLine(currentStep?.line ?? null)
    if (currentStep) editor?.revealLine(currentStep.line)
    return () => editor?.highlightLine(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  useEffect(() => {
    if (!playing) return undefined
    if (stepIndex >= steps.length - 1) {
      setPlaying(false)
      return undefined
    }
    playTimerRef.current = setTimeout(() => setStepIndex((i) => Math.min(i + 1, steps.length - 1)), AUTO_PLAY_MS)
    return () => clearTimeout(playTimerRef.current)
  }, [playing, stepIndex, steps.length])

  if (status === 'running') {
    return <p className="trace-view__empty">Tracing…</p>
  }
  if (!trace) {
    return <p className="trace-view__empty">Click Trace to step through this code one line at a time.</p>
  }
  if (steps.length === 0) {
    return <p className="trace-view__empty">Nothing to trace - the code didn't get far enough to record a step.</p>
  }

  const lineSteps = steps.filter((s) => s.event === 'line')
  const variableNames = []
  for (const step of steps) {
    for (const name of Object.keys(step.locals)) {
      if (!variableNames.includes(name)) variableNames.push(name)
    }
  }
  const stdoutSoFar = trace.stdout.slice(0, currentStep?.stdoutLen ?? 0)

  function goTo(index) {
    setPlaying(false)
    setStepIndex(Math.max(0, Math.min(steps.length - 1, index)))
  }

  function handleCopyTable() {
    const header = ['Line', ...variableNames].join('\t')
    const rows = lineSteps.map((s) => [s.line, ...variableNames.map((name) => s.locals[name] ?? '')].join('\t'))
    navigator.clipboard?.writeText([header, ...rows].join('\n'))
  }

  return (
    <div className="trace-view">
      {trace.truncated && (
        <p className="trace-view__notice">Trace stopped after {steps.length} steps so it doesn't run forever - showing the start of the run only.</p>
      )}
      {!trace.ok && trace.error && (
        <p className="trace-view__notice trace-view__notice--error">
          The traced run hit an error: {trace.error.type}
          {trace.error.message ? `: ${trace.error.message}` : ''}
        </p>
      )}

      <div className="trace-view__scrubber">
        <button type="button" className="btn btn--small" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
          &larr; Back
        </button>
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          value={stepIndex}
          onChange={(e) => goTo(Number(e.target.value))}
          aria-label="Trace step"
        />
        <button type="button" className="btn btn--small" onClick={() => goTo(stepIndex + 1)} disabled={stepIndex >= steps.length - 1}>
          Next &rarr;
        </button>
        <button
          type="button"
          className="btn btn--small"
          onClick={() => setPlaying((p) => !p)}
          disabled={!playing && stepIndex >= steps.length - 1}
        >
          {playing ? 'Pause' : 'Auto-play'}
        </button>
        <span className="trace-view__step-count">
          Step {stepIndex + 1} of {steps.length} - line {currentStep.line}
        </span>
      </div>

      <section className="trace-view__watch">
        <h3>Variables</h3>
        {Object.keys(currentStep.locals).length === 0 ? (
          <p className="trace-view__empty">No local variables yet.</p>
        ) : (
          <dl className="trace-view__watch-list">
            {Object.entries(currentStep.locals).map(([name, value]) => {
              const changed = previousStep ? previousStep.locals[name] !== value : true
              return (
                <div key={`${name}-${stepIndex}`} className={changed ? 'trace-view__watch-row trace-view__watch-row--changed' : 'trace-view__watch-row'}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              )
            })}
          </dl>
        )}
      </section>

      <section className="trace-view__stdout">
        <h3>Output so far</h3>
        <pre>{stdoutSoFar || '(none yet)'}</pre>
      </section>

      <section className="trace-view__table">
        <div className="trace-view__table-head">
          <h3>Trace table</h3>
          <button type="button" className="btn btn--small" onClick={handleCopyTable}>
            Copy table
          </button>
        </div>
        <div className="trace-view__table-scroll">
          <table>
            <thead>
              <tr>
                <th>Line</th>
                {variableNames.map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineSteps.map((s, i) => (
                <tr key={i} className={s === currentStep ? 'trace-view__table-row--current' : undefined}>
                  <td>{s.line}</td>
                  {variableNames.map((name) => (
                    <td key={name}>{s.locals[name] ?? '–'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
