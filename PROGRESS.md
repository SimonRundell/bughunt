# BugHunt progress log

Read `BUILD.md` first for the full brief. This file tracks what's actually
built, what's verified, and what's still open, so work can be picked up
without re-deriving context. Updated at the end of each phase (and
mid-phase when something notable changes).

## Status: Phase 1 done (vertical slice), Phase 2 not started

Last verified: 2026-11-20, against the live dev server
(`npm run dev`, Vite on :5173) and WINSRV's PHP server (:8080).

## Local environment (this machine)

BUILD.md assumes Laragon; this machine actually runs **WINSRV** instead
(a lighter bundled PHP + MariaDB, not Laragon) - see README's "Backend
(local dev)" section for the exact ports and the one real caveat (no
`.htaccess` enforcement locally, so `.config.json`'s secrets are only as
safe as the project root is, which is fine on this single-user machine but
wouldn't be once deployed - Apache's `.htaccess` deny rules handle that
case). Node/npm live at `C:\WINSRV\node`, not on PATH - prefix commands
with `export PATH="/c/WINSRV/node:$PATH"` (bash) or call the `.exe`/`.cmd`
directly (PowerShell).

Global conventions (stack defaults, cors.php/.htaccess patterns, licensing,
interaction style) now live in `C:\Users\simonrundell\.claude\CLAUDE.md`,
not repeated here.

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

## Next: Phase 2 (Puzzle player)

Per BUILD.md 13: extend `harness.py` with `run_tests` (section 4.5's full
spec - fresh namespace per test, `expect_kind`/`compare_mode` handling,
hidden-test masking), a Tests tab, the Puzzle page layout and the
Debugging Loop stepper, tiered hints, post-solve explanation with the
Monaco diff view, Give-up flow, scoring/ranks/badges (`src/config/
scoring.js`), the `localStorage` progress store, and a Progress page with
export/import. Puzzles load from `src/dev/samplePuzzles.json` for now
(API switch is Phase 3). Build phase-by-phase and stop for a smoke test
per BUILD.md section 14 before moving to Phase 3.
