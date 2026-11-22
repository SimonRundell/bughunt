/**
 * Main-thread wrapper around pyodide.worker.js. Promise-based API; one
 * worker is kept warm between runs, started lazily on first use. Each run
 * executes in a fresh Python namespace (see harness.py) so state never
 * leaks between runs, but the Pyodide runtime itself stays loaded.
 */

const STDIN_BUFFER_BYTES = 8 + 8192 // 2 Int32 header slots + 8KB of text

let worker = null
let interruptBuffer = null
let interruptArray = null
let stdinBuffer = null
let stdinSync = null
let stdinBytes = null
let readyPromise = null
let lastInitOpts = null

/** True when SharedArrayBuffer is usable, i.e. the page is cross-origin isolated. */
export function isInteractiveInputSupported() {
  return typeof SharedArrayBuffer !== 'undefined'
}

function createWorker() {
  return new Worker(new URL('./pyodide.worker.js', import.meta.url), { type: 'module' })
}

/**
 * Loads Pyodide in the worker. Safe to call more than once; later calls
 * return the same in-flight/completed promise.
 *
 * @param {object} opts
 * @param {string} opts.pyodideUrl - indexURL for Pyodide's own data files.
 * @param {string} opts.harnessSource - contents of harness.py.
 */
export function init({ pyodideUrl, harnessSource }) {
  if (readyPromise) {
    return readyPromise
  }

  lastInitOpts = { pyodideUrl, harnessSource }
  worker = createWorker()

  if (isInteractiveInputSupported()) {
    interruptBuffer = new SharedArrayBuffer(4)
    interruptArray = new Int32Array(interruptBuffer)
    stdinBuffer = new SharedArrayBuffer(STDIN_BUFFER_BYTES)
    stdinSync = new Int32Array(stdinBuffer, 0, 2)
    stdinBytes = new Uint8Array(stdinBuffer, 8)
  }

  readyPromise = new Promise((resolve, reject) => {
    const onMessage = (event) => {
      if (event.data.type === 'ready') {
        worker.removeEventListener('message', onMessage)
        resolve()
      }
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', (err) => reject(err), { once: true })

    worker.postMessage({
      type: 'init',
      pyodideUrl,
      harnessSource,
      stdinBuffer: stdinBuffer ?? undefined,
      interruptBuffer: interruptBuffer ?? undefined,
    })
  })

  return readyPromise
}

/**
 * Runs `code` as a fresh script. Resolves to `{ ok: true }` or
 * `{ ok: false, error: { type, message, line, col, traceback } }`.
 *
 * @param {string} code
 * @param {object} [opts]
 * @param {(text: string) => void} [opts.onStdout]
 * @param {(text: string) => void} [opts.onStderr]
 * @param {() => void} [opts.onStdinRequest] - only fires with interactive input support.
 * @param {string[]} [opts.inputLines] - pre-typed answers, fallback path only.
 * @param {number} [opts.timeoutMs]
 * @param {number} [opts.maxOutputChars]
 */
export async function run(code, opts = {}) {
  await readyPromise
  const { onStdout, onStderr, onStdinRequest, onRestarting, inputLines = [], timeoutMs = 5000, maxOutputChars = 20000 } = opts

  if (!isInteractiveInputSupported()) {
    for (const line of inputLines) {
      worker.postMessage({ type: 'stdinLine', text: line })
    }
  }

  let outputChars = 0
  let cappedNoticeSent = false

  const triggerInterrupt = () => {
    if (interruptArray) {
      Atomics.store(interruptArray, 0, 2)
    }
  }

  return new Promise((resolve) => {
    let settled = false
    const finish = (result) => {
      if (settled) return
      settled = true
      clearTimeout(hardTimer)
      worker.removeEventListener('message', onMessage)
      resolve(result)
    }

    const hardTimer = setTimeout(() => {
      triggerInterrupt()
      // Grace period for the interrupt to land before giving up on it and
      // restarting the worker entirely (section 4.3's documented fallback).
      setTimeout(async () => {
        if (settled) return
        onRestarting?.()
        await restartWorker()
        finish({ ok: false, error: { type: 'KeyboardInterrupt', message: 'Restarting Python: the run did not stop in time.', line: null, col: null, traceback: '' } })
      }, 2000)
    }, timeoutMs)

    const onMessage = (event) => {
      const msg = event.data
      if (msg.type === 'stdout' || msg.type === 'stderr') {
        outputChars += msg.text.length
        if (outputChars > maxOutputChars) {
          if (!cappedNoticeSent) {
            cappedNoticeSent = true
            onStderr?.('\n[output cut off: exceeded the output limit]\n')
            triggerInterrupt()
          }
          return
        }
        if (msg.type === 'stdout') onStdout?.(msg.text)
        else onStderr?.(msg.text)
      } else if (msg.type === 'stdinRequest') {
        onStdinRequest?.()
      } else if (msg.type === 'result') {
        const { type: _type, ...result } = msg
        finish(result)
      }
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ type: 'run', code })
  })
}

/**
 * Runs each of `puzzle.tests` against `code`, one at a time, in a fresh
 * namespace per test (harness.py's run_one_test). Each test gets its own
 * timeout, started when its `testStart` message arrives, so one hanging
 * test reports as timed out instead of killing the whole batch (BUILD.md
 * 4.3). Resolves to the full results array once every test has run.
 *
 * @param {string} code
 * @param {object} puzzle
 * @param {'function'|'script'} puzzle.entryMode
 * @param {string|null} puzzle.entryName
 * @param {object[]} puzzle.tests
 * @param {object} [handlers]
 * @param {(index: number) => void} [handlers.onTestStart]
 * @param {(result: object) => void} [handlers.onTestResult] - result includes `index`
 * @param {number} [timeoutMs]
 */
export async function runTests(code, puzzle, handlers = {}, timeoutMs = 5000) {
  await readyPromise
  const { onTestStart, onTestResult } = handlers
  const { entryMode, entryName, tests } = puzzle

  const triggerInterrupt = () => {
    if (interruptArray) {
      Atomics.store(interruptArray, 0, 2)
    }
  }

  return new Promise((resolve) => {
    const results = []
    let settled = false
    let hardTimer = null

    const onMessage = (event) => {
      const msg = event.data
      if (msg.type === 'testStart') {
        onTestStart?.(msg.index)
        hardTimer = setTimeout(triggerInterrupt, timeoutMs)
      } else if (msg.type === 'testResult') {
        clearTimeout(hardTimer)
        const { type: _type, ...result } = msg
        results[result.index] = result
        onTestResult?.(result)
      } else if (msg.type === 'testsDone') {
        if (settled) return
        settled = true
        clearTimeout(hardTimer)
        worker.removeEventListener('message', onMessage)
        resolve(results)
      }
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ type: 'runTests', code, entryMode, entryName, tests })
  })
}

/**
 * Traces `code` once with sys.settrace (harness.py's run_trace, BUILD.md
 * 4.6). Pass `test` to trace that specific test case's args/kwargs/stdin
 * ("trace this test case"); omit it to trace the code as a plain script,
 * same inputs as a free Run.
 *
 * @param {string} code
 * @param {object} opts
 * @param {'function'|'script'} opts.entryMode
 * @param {string|null} opts.entryName
 * @param {object|null} [opts.test]
 * @param {number} [opts.maxSteps]
 * @param {number} [timeoutMs]
 * @returns {Promise<{ok: boolean, error: object|null, steps: object[], stdout: string, truncated: boolean}>}
 */
export async function traceRun(code, { entryMode, entryName, test = null, maxSteps = 2000 } = {}, timeoutMs = 5000) {
  await readyPromise

  const triggerInterrupt = () => {
    if (interruptArray) {
      Atomics.store(interruptArray, 0, 2)
    }
  }

  return new Promise((resolve) => {
    let settled = false
    const hardTimer = setTimeout(triggerInterrupt, timeoutMs)

    const onMessage = (event) => {
      const msg = event.data
      if (msg.type !== 'traceResult' || settled) return
      settled = true
      clearTimeout(hardTimer)
      worker.removeEventListener('message', onMessage)
      const { type: _type, ...result } = msg
      resolve(result)
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ type: 'runTrace', code, entryMode, entryName, test, maxSteps })
  })
}

/** Submits one line of interactive input in response to onStdinRequest. */
export function submitStdinLine(text) {
  if (!stdinSync) return
  const encoded = new TextEncoder().encode(text.endsWith('\n') ? text : text + '\n')
  const len = Math.min(encoded.length, stdinBytes.length)
  stdinBytes.set(encoded.subarray(0, len))
  Atomics.store(stdinSync, 1, len)
  Atomics.store(stdinSync, 0, 1)
  Atomics.notify(stdinSync, 0)
}

/** Manual interrupt (e.g. a Stop button), same mechanism the timeout uses. */
export function interrupt() {
  if (interruptArray) {
    Atomics.store(interruptArray, 0, 2)
  }
}

/** Fallback when an interrupt doesn't land: kill and reload the runtime. */
async function restartWorker() {
  worker?.terminate()
  readyPromise = null
  worker = null
  if (lastInitOpts) {
    await init(lastInitOpts)
  }
}
