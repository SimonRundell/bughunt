import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import CodeEditor from '../editor/CodeEditor'
import Console from '../components/Console'
import ErrorExplainer from '../components/ErrorExplainer'
import harnessSource from '../python/harness.py?raw'
import { init, interrupt, isInteractiveInputSupported, run, submitStdinLine } from '../python/runner'
import { useSettings } from '../hooks/useSettings'
import { fontFamilyStack } from '../store/settings'

const STARTER_CODE = `print("Hello from Python!")
name = input("What's your name? ")
print("Hi,", name)
`

/**
 * Free-run Python playground (BUILD.md Phase 1 vertical slice). Puzzle
 * pages reuse the same CodeEditor/Console/runner pieces from Phase 2 on.
 */
export default function Playground() {
  const [code, setCode] = useState(STARTER_CODE)
  const [status, setStatus] = useState('loading') // loading | ready | running | restarting
  const [lines, setLines] = useState([])
  const [error, setError] = useState(null)
  const [awaitingInput, setAwaitingInput] = useState(false)
  const [inputLinesDraft, setInputLinesDraft] = useState('')
  const [appConfig, setAppConfig] = useState(null)
  const editorRef = useRef(null)
  const interactiveInput = isInteractiveInputSupported()
  const settings = useSettings()

  useEffect(() => {
    client.get('/public-config.php').then((res) => setAppConfig(res.data.data))

    init({ pyodideUrl: '/pyodide/', harnessSource }).then(() => setStatus('ready'))
  }, [])

  /** Appends a chunk of stdout/stderr, coalescing onto the last entry when
   * it's the same stream so the DOM doesn't get one node per character. */
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

    const inputLines = interactiveInput
      ? []
      : inputLinesDraft.split('\n').filter((l) => l.length > 0)

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
      if (result.error.line) {
        editorRef.current?.setMarkers([
          {
            startLineNumber: result.error.line,
            endLineNumber: result.error.line,
            startColumn: 1,
            endColumn: 1000,
            message: `${result.error.type}: ${result.error.message}`,
            severity: 8, // monaco.MarkerSeverity.Error
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

  function handleStop() {
    interrupt()
  }

  return (
    <div className="playground">
      <div className="playground__editor">
        <CodeEditor
          ref={editorRef}
          value={code}
          onChange={setCode}
          fontSize={settings.editorFontSize}
          fontFamily={fontFamilyStack(settings.editorFontFamily)}
          lineNumbers={settings.showLineNumbers}
        />
      </div>
      <div className="playground__side">
        <div className="playground__toolbar">
          <button type="button" className="btn btn--primary" onClick={handleRun} disabled={status !== 'ready'}>
            Run
          </button>
          <button type="button" className="btn" onClick={handleStop} disabled={status !== 'running'}>
            Stop
          </button>
          <span className="playground__status">
            {status === 'loading' && 'Starting Python, first load is the slowest…'}
            {status === 'restarting' && 'Restarting Python…'}
            {status === 'running' && 'Running…'}
            {status === 'ready' && 'Ready'}
          </span>
        </div>

        <p className="editor-a11y-hint">
          Keyboard: Tab indents inside the editor. Press Ctrl+M (Ctrl+Shift+M on Mac) to make Tab move focus out instead.
        </p>

        {!interactiveInput && (
          <div className="playground__inputs">
            <label htmlFor="pg-inputs">
              Inputs (one per line - this browser can't pause mid-run to ask for them)
            </label>
            <textarea
              id="pg-inputs"
              value={inputLinesDraft}
              onChange={(e) => setInputLinesDraft(e.target.value)}
              rows={3}
            />
          </div>
        )}

        <Console lines={lines} awaitingInput={awaitingInput} onSubmitInput={handleSubmitInput} />
        <ErrorExplainer error={error} />

        {appConfig && (
          <p className="playground__footer">
            Allowed imports: {appConfig.allowedImports.join(', ')}
          </p>
        )}
      </div>
    </div>
  )
}
