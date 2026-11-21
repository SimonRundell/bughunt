# BugHunt progress log

Read `BUILD.md` first for the full brief. This file tracks what's actually
built, what's verified, and what's still open, so work can be picked up
without re-deriving context. Updated at the end of each phase (and
mid-phase when something notable changes).

## Status: Phase 2 done (puzzle player), Phase 3 not started

Last verified: 2026-11-20, against the live dev server (`npm run dev`,
Vite on :5173) and Laragon's Apache/PHP (:80) + MariaDB (:3306).

## Local environment (this machine)

This machine (home) runs **Laragon** as BUILD.md assumes: Apache on
`localhost:80`, docroot repointed straight at this project folder, and
MariaDB on `127.0.0.1:3306` with a dedicated `developer` user (not root).
See README's "Backend (local dev)" section for details. Apache enforces
`.htaccess` here (unlike the WINSRV built-in-server environment this was
previously developed on), so `/.config.json` genuinely 403s locally too.

An earlier session developed this on a different machine running
**WINSRV** (lighter bundled PHP + MariaDB, ports 8080/3307) instead of
Laragon - `.env.development` and `.config.json` have been switched back to
Laragon's ports/credentials for this machine. If picking this up on the
WINSRV machine again, those two files will need to flip back.

Global conventions (stack defaults, cors.php/.htaccess patterns, licensing,
interaction style) now live in `C:\Users\spr\.claude\CLAUDE.md`, not
repeated here.

## Phase 0 (Scaffold) - done

Vite + React 19 (JS, no TS) scaffolded in place, full `src/`/`api/` folder
layout from BUILD.md 4.2, `api/cors.php`/`config.php`/`db.php`/
`lib/response.php`/`public-config.php`, `.htaccess` files, `.gitignore`,
`.config.example.json`, `LICENSE.md`, README, react-doctor installed.
Pyodide pinned at **314.0.8** (bundles **Python 3.14.2** - confirmed from
`pyodide-lock.json`).

Acceptance checks (BUILD.md 13): `npm run dev` loads a blank shell,
`public-config.php` returns JSON for a dev origin, and `.config.json`
can't be fetched over HTTP (it lives in the project root per Simon's
global convention; see the WINSRV caveat above for the one case where
that's weaker than `.htaccess` would make it).

## Phase 1 (Python runtime + editor) - done, browser-verified

### What's built

- `src/editor/monacoSetup.js` + `CodeEditor.jsx` - local, self-hosted
  Monaco, Python language only, editor worker via Vite's `?worker`.
- `src/python/pyodide.worker.js` - module worker running Pyodide. Both
  interactive-input paths from BUILD.md 4.3 are implemented: a
  `SharedArrayBuffer` + `Atomics.wait` blocking path when
  `crossOriginIsolated`, and a pre-typed-lines fallback otherwise.
  Interrupt via `setInterruptBuffer` (writing `2`), with a hard
  terminate-and-reload fallback if the interrupt doesn't land in time.
- `src/python/harness.py` - `run_script(code)` only so far (fresh
  `__main__` namespace, structured error info as JSON). `run_tests` lands
  in Phase 2 with the Tests tab.
- `src/python/runner.js` - main-thread promise API: `init()`, `run()`,
  `interrupt()`, `submitStdinLine()`, `isInteractiveInputSupported()`.
  Handles the run timeout, the output-character cap, and the
  restart-on-stuck-interrupt fallback.
- `src/python/errorDecoder.js` + `errorFixtures.js` - pattern table
  covering every exception type BUILD.md 4.7 lists, 27 fixtures.
- `src/components/Console.jsx`, `ErrorExplainer.jsx`, `src/pages/
  Playground.jsx`, `src/pages/dev/ErrorsDebug.jsx` (dev-only, `/dev/errors`).
- Routing added (`react-router-dom`, `BrowserRouter` in `main.jsx`);
  `/` redirects to `/playground`.
- `CMFloatAd` (Simon's standard Exeter College footer component) wired
  into `App.jsx`, rendered globally.

### Verified (headless Chrome via Playwright, scripted - no chromium-cli
on this machine, so a throwaway `playwright-core` + system Chrome script
was used instead; not saved as a project skill, see "Open items" below)

- Monaco loads with Python syntax highlighting, starter code visible.
- Pyodide loads to "Ready" and Run executes it.
- Interactive `input()`: prompt and the student's typed answer render
  inline on the same line, like a real terminal, then execution
  continues correctly (`SharedArrayBuffer` path - this browser was
  cross-origin isolated).
- A real syntax error (missing colon) produces Python's actual message
  (`SyntaxError: expected ':'`), decoded correctly, with a squiggle on
  the right line in Monaco.
- `while True: pass`, then Stop: `KeyboardInterrupt` raised, decoded,
  the runtime recovers to "Ready" without needing a full worker restart
  (the preferred path in BUILD.md 4.3 worked; the harder terminate-and-
  reload fallback was not exercised).
- `/dev/errors` renders all 27 fixtures with no page errors.
- No console errors in any of the above.

### Bugs found and fixed during this verification pass

- **`copy-pyodide.mjs` was missing `pyodide.asm.mjs`.** Pyodide's loader
  fetches this file from `indexURL` via a runtime `import()`, not through
  Vite's module graph - it has to be a real file alongside the wasm/lock/
  stdlib data. Build worked, page didn't. Fixed.
- **`monaco-editor` 0.57's import paths have moved** from what BUILD.md's
  recipe assumed: no `edcore.main` entry point, and Python's Monarch
  grammar is now at `languages/definitions/python/register`, not
  `basic-languages/python/python.contribution`. Also, the package's
  `exports` map means the subpath is `monaco-editor/editor/editor.api`,
  not `monaco-editor/esm/vs/editor/editor.api` (the `esm/vs` prefix is
  implicit). Fixed in `monacoSetup.js`.
- **stdout/stderr switched from `batched` to `raw`.** `batched` can't
  distinguish a finished line from a flushed partial line (which is
  exactly what `input()`'s prompt is), so the prompt and the student's
  echoed answer were landing on the wrong lines relative to surrounding
  output. `raw` (character-level) preserves the real byte stream, so
  ordering matches a real terminal exactly. `runner.js`/`Playground.jsx`
  coalesce consecutive same-stream characters into one state entry so
  this doesn't flood the DOM with one node per character.

## Phase 2 (Puzzle player) - done, browser-verified

### What's built

- **`harness.py`**: added `run_one_test(code, entry_mode, entry_name,
  test_json)` per BUILD.md 4.5 - fresh namespace per test (`__main__` in
  script mode, `student` in function mode), `expect_kind` (`returns`/
  `stdout`/`raises`) and `compare_mode` (`exact`/`float_tol`/`trim_stdout`/
  `exact_stdout`) handling, a clear message when the entry function is
  missing, and a `_SafeEncoder` fallback (`repr()`) for anything
  `json.dumps` can't natively encode. Verified directly against Pyodide
  (not just through the UI) with 8 hand-picked cases covering every
  expect_kind/compare_mode combination, a missing entry point, and a
  syntax error - see the commit history for the throwaway Node+Pyodide
  script used (not kept in the repo).
- **`pyodide.worker.js`/`runner.js`**: `runTests()` runs each test one at a
  time (`handleRunTests` in the worker), posting `testStart`/`testResult`/
  `testsDone`; the main thread starts a fresh timeout per `testStart` and
  triggers the shared interrupt buffer on a hang, so one stuck test reports
  as timed out instead of killing the batch (BUILD.md 4.3). Verified live:
  a batch with one fast test and two deliberately-hanging tests completed
  with the hanging ones independently interrupted and labelled
  `KeyboardInterrupt`, fast test unaffected.
- **`src/dev/samplePuzzles.json` + `puzzleSource.js`**: one puzzle per
  track (Colon Needed, Mystery Name, The Missing Number - BUILD.md's own
  worked example, Infinite Descent, Grade Calculator), plus the 6 concept
  cards they reference. `puzzleSource.js` exposes the same function names
  the real API client will in Phase 3 (`getTracks`, `getPuzzle`, `getHint`,
  `getSolution`, etc.) so swapping to HTTP later shouldn't touch the pages.
  Every puzzle verified with the same fixed-passes/buggy-fails/differs
  check the admin Verify button will eventually run.
- **`src/config/scoring.js`**: XP by difficulty, cumulative hint penalty
  (capped), diagnosis/clean-solve bonus multipliers, rank thresholds,
  static badge metadata. `mergeScoringConfig` layers `public-config.php`'s
  `app.scoring` block on top of the defaults (Phase 3 will start actually
  populating that block).
- **`src/store/progress.js`/`settings.js`**: versioned `localStorage`
  shape per BUILD.md 9.4, try/catch on every read/write, badge-awarding
  logic (first fix, read-the-error, trace-master, track-complete, no-hints
  track, boss-slayer, streak), export/import/reset.
- **Components**: `TestResults` (visible tests show expected/actual,
  hidden tests show only pass/fail + a generic note, `aria-live` run
  status), `DebugLoopStepper` (6 steps; "Locate" has no trigger yet - see
  gaps below, this is correct not missing), `HintPanel` (3 tiers, strictly
  ordered, upfront XP cost), `ExplanationPanel` (Monaco `DiffEditor`,
  student code vs fix, bug lines highlighted via `deltaDecorations`),
  `XpBar`, `BadgeToast`.
- **Pages**: `Puzzle.jsx` (the full player - brief, stepper, hypothesis
  note, hints, Monaco, Console/Tests/Error Explainer tabs, Run/Run
  tests/Stop/Reset/Give-up, draft-code autosave debounced 500ms),
  `Home.jsx` (track map + XP bar), `Track.jsx` (puzzle list with
  solved checkmarks), `Progress.jsx` (XP, badges, export/import/reset).
  Routes wired in `App.jsx`: `/`, `/track/:slug`, `/puzzle/:slug`,
  `/progress` (`/concepts`, `/about`, admin are later phases).

### Deliberately not built this phase (Phase 4 scope per BUILD.md 13)

Diagnose (flag a suspect line + bug-type picker), Trace/variable watch,
and Predict-first are all explicitly listed under Phase 4 in BUILD.md's
build order, despite section 3.3 describing them alongside the Phase-2
features. The progress store's `diagnosis` field and the sample puzzles'
`predict_prompt_md` are present (matching the documented shape) but
unused until Phase 4 wires them up. One consequence: the Debugging Loop's
"Locate" step has no trigger yet and will never tick this phase - that's
expected, not a bug, since its only documented triggers (Diagnose, Trace)
don't exist yet.

### Bugs found and fixed during this pass

- **Timeout-during-`input()` surfaced as a confusing `InternalError`.**
  Interrupting a run blocked on `input()` threw a plain JS error that
  Pyodide's stdin layer turned into `OSError: [Errno 29] I/O error`, but
  the interrupt flag was never cleared, so it fired a *second* time (a
  genuine `KeyboardInterrupt`) while `_describe()` was formatting the
  first error's traceback - which escaped as an unhandled `PythonError`.
  Fixed by clearing the interrupt buffer the moment `readStdinBlocking`
  notices it (`pyodide.worker.js`), and added a decoder entry + fixture
  for the resulting clean `OSError: [Errno 29]` so it now reads "Stopped:
  timed out waiting for input" instead of crashing. Found while
  smoke-testing the Laragon switch, before Phase 2 proper started.
- **XP farming via re-solving.** `recordSolve` originally added XP and
  incremented `xpAwarded` on every call regardless of whether the puzzle
  was already solved, so re-running "Run tests" on an already-solved
  puzzle paid out again and again. Caught by a throwaway Vitest check
  (not kept) before it ever reached the browser; fixed by gating the XP
  add on `!alreadySolved`.
- **Explanation panel overlapping the toolbar when it's tall.** `.puzzle`
  used a fixed `height: 100svh`; once the explanation panel (or badge
  toast) added content below the toolbar, the flex column had nowhere to
  put the extra height and visibly overlapped instead of growing the
  page. Fixed by switching to `min-height: 100svh` so the page scrolls
  normally once there's more content than one screenful.
- **Revisiting an already-solved puzzle showed "+0 XP".** The
  explanation panel's XP figure came from local component state that's
  only set at the moment of solving, not restored from the persisted
  `xpAwarded` on mount. Fixed by seeding it from `puzzleState.xpAwarded`
  when `solvedAt` is already set on load.

### Verified live (Laragon + Vite dev server, Playwright-driven Chrome)

- Full solve flow on "The Missing Number": buggy code fails 3 of 4 tests
  (visible tests show expected/actual; the failing hidden test shows only
  "Failed" + the generic note); fixing the code and re-running passes all
  4, awards 22 XP (20 base x 1.10 clean-solve bonus, no hints used -
  matches `computeXp` by hand), awards First Fix + Track Complete + No
  Hints badges via `BadgeToast`, and opens `ExplanationPanel` with a
  working diff and the bug line highlighted.
- Debugging Loop ticks correctly through a fail-then-fix cycle: Reproduce
  and Read tick after a failing run + opening the Tests tab; Fix and
  Verify tick after changing the code and passing; Locate and Hypothesise
  correctly stay untouched without their triggers.
- Hint reveal: tier 1 content renders (Markdown via `react-markdown`),
  tier 2 shows its own cumulative cost and stays locked until tier 1 is
  revealed.
- Give Up flow on a fresh puzzle: two-click confirm, explanation panel
  shows "Here's what was going on" with 0 XP, puzzle stays unsolved
  (retryable).
- Progress persistence: XP and the track's solved checkmark survive a
  full page reload; the Progress page's Reset (two-click confirm)
  correctly zeroes XP/badges/puzzle state.
- `npm run build` succeeds; `oxlint` clean (one pre-existing, unrelated
  warning in `cmFloatAd.jsx`).
- No console or server errors through any of the above.

## Known gaps / not yet verified

- **`errorFixtures.js` wording**: only the "missing colon" `SyntaxError`
  was confirmed live against the pinned Pyodide 314.0.8 build. The other
  26 patterns' exact message text (matched by regex in `errorDecoder.js`)
  are written from known CPython 3.10+ wording but not individually
  re-run through the actual runtime yet. Worth clicking through `/dev/
  errors` and triggering a few more directly in the Playground before
  trusting them fully, particularly `UnboundLocalError`, the `'=='`
  suggestion message, and `StopIteration` (whose real message is often
  empty, which the fixture reflects but hasn't been confirmed).
- **Non-isolated fallback input path** (pre-typed "Inputs" textarea, no
  `SharedArrayBuffer`) is implemented but not exercised live - the test
  browser was cross-origin isolated, so only the interactive path ran.
- **Hard worker-restart fallback** (when an interrupt doesn't land within
  the grace period) is implemented but not exercised live - would need
  code that ignores `KeyboardInterrupt`, which is harder to construct
  reliably as a test.
- **Output cap** (`maxOutputChars`) truncation is implemented but not
  exercised live.
- **Bundle size**: the production build is ~3MB JS (~815KB gzipped) in
  one chunk, mostly Monaco + Pyodide's JS loader. Works fine, but Vite
  warns about chunk size. Code-splitting (`React.lazy` for the Playground/
  Monaco bundle) would be a reasonable Phase 5 polish item, not a blocker.
- **`favicon.png`**: Simon mentioned wiring in a real PNG icon (replacing
  the Vite default SVG) from another editing session on this same folder,
  but the file hasn't appeared in `/public` yet. `index.html` still points
  at `favicon.svg`. Swap this in once the PNG lands.
- **No project-specific browser-testing skill was saved.** Testing used a
  one-off `playwright-core` script against the system-installed Chrome
  (`C:\Program Files\Google\Chrome\Application\chrome.exe`), since
  `chromium-cli` isn't set up on this machine. If browser smoke-testing
  becomes a recurring need, `/run-skill-generator` could capture that
  recipe properly.

## Next: Phase 3 (Backend and admin)

Per BUILD.md 13: `api/sql/schema.sql` + `seed.sql` (tracks, concepts and
the 5 sample puzzles already in `samplePuzzles.json` are a natural seed
set), the public endpoints (`tracks.php`, `puzzles.php`, `puzzle.php`,
`hint.php`, `solution.php`, `concepts.php`/`concept.php`), then switch
`puzzleSource.js`'s callers (or replace it with `src/api/puzzles.js`)
from the local JSON to Axios calls against those endpoints. Then admin
auth (`create_admin.php`, hashed bearer tokens, login rate limiting), the
puzzle editor with its Verify flow (reusing the same browser runner the
player uses), tracks/concepts CRUD, and import/export. Build phase-by-
phase and stop for a smoke test per BUILD.md section 14 before moving to
Phase 4.
