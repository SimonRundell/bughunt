/**
 * Tests tab (BUILD.md 4.5, 9.2). Visible tests show label, expected,
 * actual and a pass/fail state; hidden tests show only the label and
 * pass/fail, never the expected value or the student's actual output
 * (BUILD.md 4.5 point 6). Run status is announced through an aria-live
 * region so screen reader users don't have to poll the list (BUILD.md 11).
 * "Trace this test case" (BUILD.md 4.6) is only offered for visible
 * tests - tracing a hidden test would leak its exact input values
 * through the variable watch, defeating the point of hiding it.
 *
 * @param {object} props
 * @param {object[]} props.tests - puzzle.tests, static definitions (label, hidden, ...)
 * @param {Record<number, object>} props.results - keyed by test index, as they complete
 * @param {number|null} props.runningIndex - index currently executing, or null
 * @param {'idle'|'running'|'done'} props.status
 * @param {(test: object) => void} [props.onTraceTest]
 */
export default function TestResults({ tests, results, runningIndex, status, onTraceTest }) {
  const passedCount = Object.values(results).filter((r) => r.passed).length

  return (
    <div className="test-results">
      <p className="test-results__summary" aria-live="polite">
        {status === 'idle' && 'Run tests to see results here.'}
        {status === 'running' && `Running test ${(runningIndex ?? 0) + 1} of ${tests.length}…`}
        {status === 'done' && `${passedCount} of ${tests.length} tests passed.`}
      </p>
      <ul className="test-results__list">
        {tests.map((test, index) => {
          const result = results[index]
          const isRunning = status === 'running' && runningIndex === index
          const state = isRunning ? 'running' : result ? (result.passed ? 'passed' : 'failed') : 'pending'

          return (
            <li key={index} className={`test-results__item test-results__item--${state}`}>
              <div className="test-results__head">
                <span className="test-results__icon" aria-hidden="true">
                  {state === 'passed' && '✓'}
                  {state === 'failed' && '✗'}
                  {state === 'running' && '…'}
                  {state === 'pending' && '•'}
                </span>
                <span className="test-results__label">
                  {test.hidden ? `Hidden test: ${test.label}` : test.label}
                </span>
                <span className="test-results__state-text">
                  {state === 'passed' && 'Passed'}
                  {state === 'failed' && 'Failed'}
                  {state === 'running' && 'Running'}
                  {state === 'pending' && 'Not run yet'}
                </span>
                {!test.hidden && onTraceTest && (
                  <button type="button" className="btn btn--small" onClick={() => onTraceTest(test)}>
                    Trace this test
                  </button>
                )}
              </div>

              {result && !result.passed && test.hidden && (
                <p className="test-results__hidden-note">
                  This hidden test didn't pass. Its expected value and your actual result aren't shown -
                  use the visible tests and the Error Explainer to work out why.
                </p>
              )}

              {result && !test.hidden && (
                <dl className="test-results__detail">
                  <dt>Expected</dt>
                  <dd>
                    <code>{formatValue(result.expected)}</code>
                  </dd>
                  <dt>Actual</dt>
                  <dd>
                    <code>{formatValue(result.actual)}</code>
                  </dd>
                  {result.error && (
                    <>
                      <dt>Error</dt>
                      <dd>
                        <code>
                          {result.error.type}
                          {result.error.message ? `: ${result.error.message}` : ''}
                        </code>
                      </dd>
                    </>
                  )}
                </dl>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatValue(value) {
  if (value === null || value === undefined) return 'nothing'
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}
