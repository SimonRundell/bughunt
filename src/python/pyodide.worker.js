/**
 * Pyodide runs here, in a dedicated module worker: no DOM, no cookies, no
 * localStorage, no admin token. The server never executes student code.
 *
 * Messages in (main thread -> worker): see runner.js for the matching
 * promise-based API. Messages out (worker -> main thread):
 *   { type: 'ready' }
 *   { type: 'stdout' | 'stderr', text }
 *   { type: 'stdinRequest' }
 *   { type: 'result', ok, error? }
 */

/** @type {import('pyodide').PyodideInterface | null} */
let pyodide = null
let runScript = null
let runOneTest = null
let runTrace = null

/** Int32Array over the interrupt SharedArrayBuffer, or null when unavailable. */
let interruptArray = null

/** Shared buffer for the isolated (SharedArrayBuffer) interactive-input path. */
let stdinSync = null // Int32Array(2): [0] = ready flag, [1] = byte length
let stdinBytes = null // Uint8Array view over the same buffer, offset 8

/** Pre-typed input lines for the non-isolated fallback path, queued before `run`. */
const fallbackInputLines = []

function postStdout(text) {
  postMessage({ type: 'stdout', text })
}

function postStderr(text) {
  postMessage({ type: 'stderr', text })
}

/** Blocks the worker via Atomics.wait until the main thread supplies a line. */
function readStdinBlocking() {
  postMessage({ type: 'stdinRequest' })
  Atomics.store(stdinSync, 0, 0)

  // Poll in short waits (rather than one indefinite wait) so an interrupt
  // requested while we're blocked on input still gets noticed promptly.
  for (;;) {
    Atomics.wait(stdinSync, 0, 0, 100)
    if (Atomics.load(stdinSync, 0) === 1) {
      break
    }
    if (interruptArray && Atomics.load(interruptArray, 0) !== 0) {
      // Clear it now: Pyodide's own interrupt checks auto-clear the buffer
      // when a CPU-bound loop is interrupted, but this path raises a plain
      // JS error instead of a native KeyboardInterrupt, so nothing else
      // consumes the flag. Left set, it fires a second time (as a genuine
      // KeyboardInterrupt) while run_script's except-clause is still
      // formatting a traceback for the first error, which escapes as an
      // unhandled PythonError instead of a clean result.
      Atomics.store(interruptArray, 0, 0)
      throw new Error('Interrupted while waiting for input.')
    }
  }

  const len = Atomics.load(stdinSync, 1)
  const text = new TextDecoder().decode(stdinBytes.slice(0, len))
  Atomics.store(stdinSync, 0, 0)
  return text
}

function stdinHandler() {
  if (stdinSync) {
    return readStdinBlocking()
  }
  if (fallbackInputLines.length > 0) {
    return fallbackInputLines.shift()
  }
  return null // EOF -> Python raises EOFError
}

async function handleInit({ pyodideUrl, harnessSource, stdinBuffer, interruptBuffer }) {
  const { loadPyodide } = await import('pyodide')
  pyodide = await loadPyodide({ indexURL: pyodideUrl })

  // `raw` (one character at a time) rather than `batched` (one call per
  // line or per explicit flush): batched gives no way to tell a finished
  // line apart from a flushed partial line (e.g. input()'s prompt, which
  // must stay on the same visual line as what the student types next), so
  // only raw preserves the exact byte stream a real terminal would show.
  pyodide.setStdout({ raw: (charCode) => postStdout(String.fromCharCode(charCode)) })
  pyodide.setStderr({ raw: (charCode) => postStderr(String.fromCharCode(charCode)) })

  if (interruptBuffer) {
    interruptArray = new Int32Array(interruptBuffer)
    pyodide.setInterruptBuffer(interruptArray)
  }

  if (stdinBuffer) {
    stdinSync = new Int32Array(stdinBuffer, 0, 2)
    stdinBytes = new Uint8Array(stdinBuffer, 8)
  }
  // isatty: false keeps input()'s prompt flowing through stdout.write (so
  // it appears in the Console like any other output) instead of trying
  // PyOS_Readline, which has no terminal to talk to here.
  pyodide.setStdin({ stdin: stdinHandler, isatty: false })

  pyodide.runPython(harnessSource)
  runScript = pyodide.globals.get('run_script')
  runOneTest = pyodide.globals.get('run_one_test')
  runTrace = pyodide.globals.get('run_trace')

  postMessage({ type: 'ready' })
}

function handleRun({ code }) {
  if (interruptArray) {
    Atomics.store(interruptArray, 0, 0)
  }
  fallbackInputLines.length = 0

  let resultJson
  try {
    resultJson = runScript(code)
  } catch (err) {
    // The interrupt-while-waiting-for-input throw above, or anything else
    // that escapes Python entirely.
    postMessage({
      type: 'result',
      ok: false,
      error: {
        type: 'InternalError',
        message: String(err && err.message ? err.message : err),
        line: null,
        col: null,
        traceback: '',
      },
    })
    return
  }

  const result = JSON.parse(resultJson)
  postMessage({ type: 'result', ...result })
}

/**
 * Runs each test in `tests` one at a time against a fresh namespace
 * (harness.py's run_one_test), posting `testStart` before each and
 * `testResult` after, then `testsDone` once the batch finishes. The main
 * thread times each test individually (runner.js) and triggers the shared
 * interrupt buffer on a hang, same mechanism as a free-run timeout.
 */
function handleRunTests({ code, entryMode, entryName, tests }) {
  for (let index = 0; index < tests.length; index++) {
    if (interruptArray) {
      Atomics.store(interruptArray, 0, 0)
    }
    postMessage({ type: 'testStart', index })

    let result
    try {
      const resultJson = runOneTest(code, entryMode, entryName, JSON.stringify(tests[index]))
      result = JSON.parse(resultJson)
    } catch (err) {
      result = {
        passed: false,
        expected: null,
        actual: null,
        stdout: '',
        error: { type: 'InternalError', message: String(err && err.message ? err.message : err), line: null, col: null, traceback: '' },
        ms: 0,
      }
    }
    postMessage({ type: 'testResult', index, ...result })
  }
  postMessage({ type: 'testsDone' })
}

/**
 * Traces the code once (harness.py's run_trace) and posts the full result
 * in one message - unlike runTests, there's no per-step streaming since
 * the scrubber/table UI needs the whole steps array before it's useful.
 */
function handleRunTrace({ code, entryMode, entryName, test, maxSteps }) {
  if (interruptArray) {
    Atomics.store(interruptArray, 0, 0)
  }

  let result
  try {
    const resultJson = runTrace(code, entryMode, entryName, test ? JSON.stringify(test) : null, maxSteps ?? 2000)
    result = JSON.parse(resultJson)
  } catch (err) {
    result = {
      ok: false,
      error: { type: 'InternalError', message: String(err && err.message ? err.message : err), line: null, col: null, traceback: '' },
      steps: [],
      stdout: '',
      truncated: false,
    }
  }
  postMessage({ type: 'traceResult', ...result })
}

self.onmessage = (event) => {
  const msg = event.data
  switch (msg.type) {
    case 'init':
      handleInit(msg).catch((err) => {
        postMessage({ type: 'result', ok: false, error: { type: 'InternalError', message: String(err), line: null, col: null, traceback: '' } })
      })
      break
    case 'run':
      handleRun(msg)
      break
    case 'runTests':
      handleRunTests(msg)
      break
    case 'runTrace':
      handleRunTrace(msg)
      break
    case 'stdinLine':
      // Pre-typed fallback input, queued before the matching 'run'.
      fallbackInputLines.push(msg.text)
      break
    default:
      break
  }
}
