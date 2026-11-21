import { loadPyodide } from 'pyodide'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const pyodide = await loadPyodide()
const harnessSource = readFileSync('E:/bughunt/src/python/harness.py', 'utf-8')
pyodide.runPython(harnessSource)
const runOneTest = pyodide.globals.get('run_one_test')

function runTest(code, entryMode, entryName, test) {
  return JSON.parse(runOneTest(code, entryMode, entryName, JSON.stringify(test)))
}

/** Fills in expect_py for returns/stdout tests by running fixed_code for real, rather than hand-computing. */
function deriveExpected(puzzle) {
  for (const test of puzzle.tests) {
    if (test.expect_py !== undefined) continue // raises tests already specify the exception name
    // run_one_test always needs *some* expect_py to compare against (even to
    // just compute `actual`) - a placeholder is fine, we only read `actual`.
    const probe = { ...test, expect_py: test.expect_kind === 'stdout' ? '""' : 'None' }
    const result = runTest(puzzle.fixed_code, puzzle.entry_mode, puzzle.entry_name, probe)
    if (result.error) {
      throw new Error(`${puzzle.slug}: fixed_code errored deriving expected for "${test.label}": ${JSON.stringify(result.error)}`)
    }
    if (test.expect_kind === 'stdout') {
      test.expect_py = JSON.stringify(result.actual)
    } else {
      test.expect_py = pyRepr(result.actual)
    }
  }
  return puzzle
}

/** Converts a JS value (as returned by run_one_test's JSON) into Python literal source for expect_py. */
function pyRepr(value) {
  if (value === null || value === undefined) return 'None'
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return JSON.stringify(value).replace(/\{/g, '{').replace(/\}/g, '}')
  if (Array.isArray(value)) return '[' + value.map(pyRepr).join(', ') + ']'
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${pyRepr(v)}`)
    return '{' + entries.join(', ') + '}'
  }
  throw new Error('Cannot pyRepr: ' + JSON.stringify(value))
}

function verify(puzzle) {
  const fixedResults = puzzle.tests.map((t) => runTest(puzzle.fixed_code, puzzle.entry_mode, puzzle.entry_name, t))
  const buggyResults = puzzle.tests.map((t) => runTest(puzzle.buggy_code, puzzle.entry_mode, puzzle.entry_name, t))
  const fixedAllPass = fixedResults.every((r) => r.passed)
  const buggyAnyFail = buggyResults.some((r) => !r.passed)
  const codeDiffers = puzzle.buggy_code !== puzzle.fixed_code
  const ok = fixedAllPass && buggyAnyFail && codeDiffers
  if (!ok) {
    console.log(`FAIL ${puzzle.slug}`)
    fixedResults.forEach((r, i) => {
      if (!r.passed) console.log(`  fixed failed test[${i}] (${puzzle.tests[i].label}): expected=${JSON.stringify(r.expected)} actual=${JSON.stringify(r.actual)} error=${JSON.stringify(r.error)}`)
    })
    if (!buggyAnyFail) console.log('  buggy passed everything (should fail at least one)')
    buggyResults.forEach((r, i) => {
      console.log(`  buggy test[${i}] (${puzzle.tests[i].label}): passed=${r.passed} actual=${JSON.stringify(r.actual)} error=${r.error ? r.error.type : null}`)
    })
  } else {
    console.log(`OK   ${puzzle.slug}`)
  }
  return ok
}

/**
 * Mirrors api/lib/puzzle_hash.php's bh_puzzle_verification_hash() exactly,
 * so puzzles seeded straight into the database (bypassing the admin
 * Verify endpoint) still carry a verified_hash the app's own publish-gate
 * will accept as current.
 */
function verificationHash(puzzle) {
  const normalisedTests = puzzle.tests.map((t) => [
    t.label ?? '',
    t.args_py ?? null,
    t.kwargs_py ?? null,
    t.stdin_text ?? null,
    t.expect_kind ?? '',
    t.expect_py ?? '',
    t.compare_mode ?? 'exact',
    Boolean(t.hidden ?? false),
  ])
  const payload = JSON.stringify([puzzle.buggy_code ?? '', puzzle.fixed_code ?? '', puzzle.entry_mode ?? '', puzzle.entry_name ?? null, normalisedTests])
  return createHash('sha256').update(payload, 'utf-8').digest('hex')
}

export { pyodide, runTest, deriveExpected, verify, pyRepr, verificationHash, writeFileSync, readFileSync }
