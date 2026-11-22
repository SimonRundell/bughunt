import { useEffect, useRef, useState } from 'react'
import CodeEditor from '../editor/CodeEditor'
import Console from './Console'
import ErrorExplainer from './ErrorExplainer'
import harnessSource from '../python/harness.py?raw'
import { init, isInteractiveInputSupported, run, submitStdinLine } from '../python/runner'

/**
 * Compact runnable snippet (BUILD.md 3.3's concept-card "Try it"): a small
 * editable editor, Run/Stop, a Console and the Error Explainer. Calls
 * `init()` itself (idempotent - returns the existing runtime if the page
 * already started one, e.g. a puzzle linking to a concept) so it works as
 * a standalone component regardless of what else is on the page.
 *
 * @param {object} props
 * @param {string} props.initialCode
 * @param {number} [props.timeoutMs]
 * @param {number} [props.maxOutputChars]
 */
export default function SnippetRunner({ initialCode, timeoutMs = 5000, maxOutputChars = 20000 }) {
  const [code, setCode] = useState(initialCode)
  const [status, setStatus] = useState('loading') // loading | ready | running | restarting
  const [lines, setLines] = useState([])
  const [error, setError] = useState(null)
  const [awaitingInput, setAwaitingInput] = useState(false)
  const editorRef = useRef(null)
  const interactiveInput = isInteractiveInputSupported()

  useEffect(() => {
    init({ pyodideUrl: '/pyodide/', harnessSource }).then(() => setStatus('ready'))
  }, [])

  function appendOutput(type, text) {
    setLines((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.type === type) {
        return [...prev.slice(0, -1), { type, text: last.text + text }]
      }
      return [...prev, { type, text }]
    })
  }

  async function handleRun() {
    setLines([])
    setError(null)
    editorRef.current?.setMarkers([])
    setStatus('running')

    const result = await run(code, {
      onStdout: (text) => appendOutput('stdout', text),
      onStderr: (text) => appendOutput('stderr', text),
      onStdinRequest: () => setAwaitingInput(true),
      onRestarting: () => setStatus('restarting'),
      timeoutMs,
      maxOutputChars,
    })

    setAwaitingInput(false)
    setStatus('ready')

    if (!result.ok) {
      setError(result.error)
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
    }
  }

  function handleSubmitInput(text) {
    appendOutput('stdout', `${text}\n`)
    submitStdinLine(text)
    setAwaitingInput(false)
  }

  return (
    <div className="snippet-runner">
      <div className="snippet-runner__editor">
        <CodeEditor ref={editorRef} value={code} onChange={setCode} fontSize={14} />
      </div>
      <div className="snippet-runner__toolbar">
        <button type="button" className="btn btn--primary btn--small" onClick={handleRun} disabled={status !== 'ready'}>
          Run
        </button>
        <span className="snippet-runner__status">
          {status === 'loading' && 'Starting Python…'}
          {status === 'restarting' && 'Restarting Python…'}
          {status === 'running' && 'Running…'}
          {status === 'ready' && 'Ready'}
        </span>
      </div>
      <Console lines={lines} awaitingInput={awaitingInput && interactiveInput} onSubmitInput={handleSubmitInput} />
      {error && <ErrorExplainer error={error} />}
    </div>
  )
}
