# BugHunt progress log

Read `BUILD.md` first for the full brief. This file tracks what's actually
built, what's verified, and what's still open, so work can be picked up
without re-deriving context. Updated at the end of each phase (and
mid-phase when something notable changes).

## Status: Phase 3 done (backend and admin), Phase 4 not started

Last verified: 2026-11-21, against the live dev server (`npm run dev`,
Vite on :5173) and Laragon's Apache/PHP (:80) + MariaDB (:3306).

## Design pass (2026-11-20) - applying CLAUDE.md's UI/UX and accessibility rules

Phase 2's components were built functionally correct but with zero
application of CLAUDE.md's design brief (Tron/futuristic mood) or several
of its CSS/accessibility rules (tokens, spacing scale, touch targets,
mobile-first breakpoints). Audited and fixed in this pass:

- **`frontend-design`, `design:design-system`, `design:accessibility-review`
  skills are not installed in this environment** - this review was done
  manually against CLAUDE.md's written rules instead of running those
  skills. If they get installed later, worth a proper pass through them.
- **Full token rewrite in `src/index.css`**: every colour is now a CSS
  variable (`--bg`, `--bg-elevated`, `--text`, `--text-muted`, `--border`,
  `--accent`, `--accent-strong`, `--danger`, `--on-accent`/`--on-danger`),
  plus a spacing scale (`--space-1` to `--space-6`) and radius/font-size
  tokens. No hardcoded hex values remain outside `:root`.
- **Dark is the only theme** (Simon's call, not a `prefers-color-scheme`
  branch - Tron doesn't have a sensible light variant). Every colour pair
  actually used (text/muted-text/accent/danger against both backgrounds,
  borders against both backgrounds) was checked against WCAG contrast
  maths before being picked, not eyeballed - see the ratios below.
- **A `.btn` system**: one primary (solid accent fill) per view, plain
  outlined secondary, `.btn--danger` for Give Up/Reset, all with a
  44x44px minimum touch target regardless of visual size. Monaco's theme
  defaults to `vs-dark` to match.
- **Mobile-first layout**: Playground and the Puzzle page now start as a
  single stacked column and widen to their grid layout at
  `@media (min-width: 900px)`, replacing the old max-width override
  approach.
- **Touch targets**: fixed plain `<Link>` back-links and footer nav
  (were ~21px tall) with a shared `.back-link`/`.home__footer-nav a`
  rule enforcing 44px.
- **Global `:focus-visible` ring** (cyan outline + glow) and a
  `prefers-reduced-motion` guard, neither of which existed before.
- **The subtle background grid** (two low-opacity `repeating-linear-
  gradient`s on `body`, colour tied to `--accent` via `color-mix()`) is
  the one deliberate Tron reference - flat panels otherwise, no
  glassmorphism, no gradients-as-hero, per the "avoid" list.

### Contrast ratios actually used (dark theme, the only one now)

| Pair | Ratio |
|---|---|
| `--text` on `--bg` / `--bg-elevated` | 17.89:1 / 16.46:1 |
| `--text-muted` on `--bg` / `--bg-elevated` | 9.23:1 / 8.49:1 |
| `--accent` on `--bg` / `--bg-elevated` | 12.55:1 / 11.54:1 |
| `--danger` on `--bg` / `--bg-elevated` | 10.97:1 / 10.09:1 |
| `--border` on `--bg` / `--bg-elevated` | 3.75:1 / 3.45:1 (UI-border tier) |
| `--on-accent` (#03181a) on `--accent` | 11.43:1 |
| `--on-danger` (#1a1100) on `--danger` | 10.22:1 |

A light-theme palette was also derived and verified (same method, darker
accent/danger shades so small text still hits 4.5:1 on white) before
Simon said to drop it and stick with dark only - not kept, since
reintroducing it later would need re-deriving those shades rather than
reusing anything currently in the code.

### Verified live (Laragon + Vite dev server)

- Home, Track, Puzzle and Progress pages all render correctly in dark
  mode at 375px and 1280px widths (measured via `getBoundingClientRect`,
  not just screenshots, which compress badly at this chat's thumbnail
  size and can look mis-centred when they aren't).
- `.btn` touch targets measured at exactly 44px even for `.btn--small`
  variants (hint reveal, badge dismiss).
- Selected tab shows both an underline and bold weight, not colour alone.
- `npm run build` and `oxlint` both clean.

### Known gap

- **`:focus-visible` could not be fully verified through this automation
  layer.** The preview tool can't dispatch a trusted keyboard Tab event. a
  programmatic `.focus()` call correctly does *not* trigger
  `:focus-visible` (that's correct browser behaviour, not a bug in the
  CSS), but it means the real keyboard experience hasn't been directly
  observed, only reasoned about from how `:focus-visible` is specified to
  work. Worth an actual Tab-through on a real keyboard before considering
  this fully signed off.

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

## Phase 3 (Backend and admin) - done, browser-verified

BUILD.md never specified teacher-vs-admin roles (it assumed one admin).
Simon's brief for this phase asked for admin + teacher accounts (teachers
added by admin, admin is also a teacher) and the full Appendix A seed
list rather than a handful of sample puzzles, so this phase is a
deliberate extension of BUILD.md 13's Phase 3 scope, agreed via
clarifying questions before starting: opaque hashed bearer tokens (not
JWT - simpler and matches BUILD.md 5.2's original design for a
single-service app), teacher role = everything admin can do except
account management, full ~55-puzzle Appendix A seed, and stable-per-
student puzzle randomisation (shuffled once, persisted, not reshuffled
every visit).

### What's built

- **`api/sql/schema.sql`**: every table from BUILD.md 6, plus
  `bh_admins.role ENUM('admin','teacher')` and `created_by` (self-FK) -
  the role extension above. All InnoDB/utf8mb4, child tables cascade-
  delete from their puzzle/concept parent.
- **`scripts/seed/`**: `build.mjs` (shared Node+Pyodide verification
  helpers - `deriveExpected` runs the *real* fixed_code through the same
  harness the browser uses to derive correct `expect_py` values rather
  than hand-computing them, `verify` checks fixed passes everything and
  buggy fails at least one), `track1.mjs`-`track5.mjs` (55 fully-authored
  puzzles), `concepts.mjs` (38 concept cards), `generate.mjs` (re-
  verifies every puzzle against the live Pyodide runtime and refuses to
  write `seed.sql` if any fail - `npm run seed:generate`). One puzzle
  (`the-search-that-hangs`) has a genuinely infinite loop in its buggy
  code by design; this script has no timeout/interrupt wiring (that's
  browser-only), so it's verified fixed-code-only via a documented
  `SKIP_BUGGY_VERIFY` exception.
- **`api/lib/auth.php`**: `random_bytes(32)` bearer tokens, only the
  SHA-256 hash stored (`bh_admin_tokens`), `PASSWORD_ARGON2ID` for
  account passwords, IP-based login rate limiting
  (`maxLoginAttemptsPer15Min`, default 8, in `.config.json`'s `auth`
  block), `bh_require_admin($minRole)` where `'admin'` satisfies any
  `'teacher'`-level check.
- **`api/tools/create_admin.php`**: CLI-only bootstrap (refuses to run
  under a web SAPI) - how the first account gets created.
- **`api/admin/login.php`/`logout.php`/`me.php`/`accounts.php`**:
  session lifecycle plus admin-only (not teacher) account create/list/
  delete, with self-delete blocked.
- **`api/admin/change_password.php`** (added mid-phase, Simon's
  follow-up request): self-service password change for *any* logged-in
  account on its own row - verifies the current password with
  `password_verify` before updating, no `admin`-role requirement since it
  never touches another account's row.
- **Public read API** (`tracks.php`, `puzzles.php`, `puzzle.php`,
  `hint.php`, `solution.php`, `concepts.php`, `concept.php`) per BUILD.md
  5.3, and the **admin CRUD API** (`admin/puzzles.php`, `puzzle.php`,
  `verify.php`, `tracks.php`, `concepts.php`, `export.php`, `import.php`)
  with `api/lib/puzzle_hash.php` computing the "has anything verification-
  relevant changed" hash that gates publishing.
- **Frontend switched from local JSON to the real API**: `src/api/
  puzzles.js` (replaces `src/dev/puzzleSource.js`), `src/store/
  puzzleOrder.js` (`applyStableRandomOrder` - Fisher-Yates shuffle once
  per track, order persisted in `localStorage` so it doesn't reshuffle on
  every visit), `Home.jsx`/`Track.jsx`/`Puzzle.jsx` updated to the async
  API shape.
- **Badge art**: `src/config/badgeImages.js` + `BadgeIcon.jsx` map badge
  ids to the PNGs Simon supplied in `/public/awards`, with a plain
  geometric (non-emoji) placeholder for badges without art yet.
- **Admin UI** (`src/pages/admin/`): `Login.jsx`, `AdminLayout.jsx`
  (session-guarded nav, hides the student-facing `SiteHeader`/
  `CMFloatAd` on `/admin/*`), `PuzzleList.jsx` (filter by track, export/
  import bundle), `PuzzleEditor.jsx` (Monaco inline diff or side-by-side,
  metadata/brief/tests/hints/bugs/concepts forms, Verify and Save &
  Publish), `TrackList.jsx`, `ConceptList.jsx`, `Accounts.jsx` (admin
  role only), `ChangePassword.jsx` (every role). `src/api/admin.js` holds
  the bearer token in `sessionStorage` (not `localStorage` - shouldn't
  outlive the tab or mix with student progress data) and attaches it via
  an Axios interceptor.

### Bugs found and fixed during this pass

- **Seeded puzzles were `published` but never verified.** `generate.mjs`
  ran every puzzle through the real Pyodide harness before writing
  `seed.sql`, but never wrote that result into `verified_hash`/
  `verified_at` - so all 55 puzzles sat in the database as published-but-
  unverified, which the admin UI's own publish-gate (`admin/puzzle.php`)
  would have refused to re-save without a fresh Verify. Fixed by adding
  `verificationHash()` to `build.mjs`, an exact JS mirror of `api/lib/
  puzzle_hash.php`'s hash (same field order, same JSON shape), and
  writing `verified_hash`/`verified_at = NOW()` into every puzzle insert.
  Caught by noticing the admin Puzzle list's "Verified" column showed
  "-" for every published puzzle; confirmed by direct `SELECT` against
  `bh_puzzles` before and after the fix.
- **`admin/puzzle.php` PUT**: `'verified_at' => $stillVerified ? null :
  null` was a copy-paste bug (always null regardless of condition).
  Fixed by fetching `existing['verified_at']` up front and using
  `$stillVerified ? $existing['verified_at'] : null`.
- **`admin/tracks.php` PUT**: `SQLSTATE[HY093]: Invalid parameter
  number` under `PDO::ATTR_EMULATE_PREPARES => false` - the full track-
  fields array (including an unused `slug` key with no matching
  placeholder) was passed straight to `->execute()`. Fixed with
  `unset($f['slug'])` first; audited every other admin endpoint's bound-
  parameter arrays for the same pattern, found no other instances.
- **`export.php`/`import.php` envelope mismatch**: `export.php`
  originally wrapped its bundle in the standard `{ok, data}` envelope,
  but `import.php` expects the raw bundle directly (it's a "download a
  file, re-upload that file" round trip, not a data-fetching call).
  Fixed by having `export.php` bypass the envelope helper and emit the
  raw JSON with `Content-Disposition: attachment`. Verified a full
  export -> import round trip restores correct child-row counts and
  resets everything to draft/unverified (importing should never silently
  re-publish unreviewed content).
- **`TabError` had no decoder entry.** Authoring the `mixed-signals`
  puzzle (tabs vs spaces) exposed that `errorDecoder.js`/
  `errorFixtures.js` didn't cover `TabError` at all. Added both.
- **A handful of puzzle-content bugs**, all caught by the Node+Pyodide
  verification harness rather than by hand: `and-or-or`'s buggy code used
  `ast.literal_eval` on a non-literal expression; `nearly-equal`'s float
  list summed to exactly `1.0` instead of demonstrating the intended
  imprecision (fixed the operand order); `bank-account`/`inventory-
  manager` compared a Python tuple against a JS-array-rendered-as-list
  test expectation (fixed by returning lists, not tuples, from the
  puzzle's own code).

### Verified live (Laragon + Vite dev server, interactive browser preview)

- **Public/student side**: Home lists all 5 tracks with correct puzzle
  counts (10/10/12/13/10 = 55); a track page shows its puzzles in
  randomised (not `sort_order`) sequence; opening a puzzle loads real
  brief/buggy code/tests from the database, and running the buggy code
  produces the expected error (`IndentationError` on "Indentation
  Station").
- **Admin auth**: unauthenticated calls to `admin/puzzles.php` correctly
  405/401 (`{"ok":false,"error":{"code":"unauthorized",...}}`); login
  rate limiting kicks in and blocks further attempts after repeated
  failures within 15 minutes, exactly as configured.
- **Admin puzzle editor**: opening an existing puzzle shows metadata,
  brief, Monaco inline diff (buggy vs fixed, correctly highlighting e.g.
  the missing colon), bugs/tests/hints sections populated; Verify
  re-runs the real harness and flips the puzzle to "Verified. You can
  publish it now."; Save & Publish is blocked with a 422 `not_verified`
  error if the content hash no longer matches the last verification.
- **Tracks, Concepts, Accounts pages**: all list and render correctly
  from the live API.
- **Account management**: admin can create a teacher account, the new
  account shows up immediately, and delete (two-click confirm) removes
  it; self-delete is blocked.
- **Self-service password change**: wrong current password is rejected
  with a clear message and makes no change; correct current password
  changes it, confirmed by logging out and back in with the new
  password, then restored to the standard dev credential for a clean
  handoff.
- **Full Phase 3 acceptance checklist (BUILD.md 13/14)**: admin can log
  in, author a puzzle (new puzzle form exercised with metadata/tests/
  hints/bugs sections all present), verify it, publish it, and it would
  appear for a student; unverified puzzles cannot be published (422);
  admin endpoints reject calls without a valid token (401).
- `npx oxlint src/ api/` clean (same two pre-existing/accepted warnings
  as Phase 2: `Track.jsx`'s and `PuzzleEditor.jsx`'s "reset state before
  an async refetch" pattern, and `cmFloatAd.jsx`'s `Date`-in-render).

### Known gaps / simplifications

- **Admin puzzle editor is intentionally simplified** versus a "full"
  content tool: bug line ranges are plain number inputs (no click-the-
  gutter-in-Monaco flagging), tests are added/removed/reordered with
  buttons (no drag-and-drop, no "capture this call from the fixed code"
  helper), and there's no "preview as a student would see it" mode. Fine
  for Simon authoring content directly; worth revisiting if non-technical
  teachers end up authoring puzzles too.
- **Badge art - resolved (2026-11-21)**: Simon supplied full art for every
  badge the app can award, and the streak system was expanded from one
  flat 3-day badge to 8 milestone tiers (`streak-5` through `streak-1000`,
  `STREAK_TIERS` in `scoring.js`) to match the art he'd already prepared.
  `badgeImages.js` now maps all of them, including one distinct
  `track-complete-*` image per track (was a single shared image before).
  `trace-master` also has art now even though it can't be earned yet
  (Tracer is Phase 4) - it'll just work once that feature lands.
- **Default admin credential** (`spr` / a test password set via
  `create_admin.php`) is a dev-only bootstrap account - change it (or
  create a proper named account and delete this one) before any real
  deployment.
- Per BUILD.md 14, this was a smoke test, not an exhaustive test suite -
  Simon should still exercise the admin UI himself before trusting it
  fully, particularly edge cases in the puzzle editor (script-mode entry,
  `raises`/`float_tol`/`trim_stdout` test variants, concept linking).

## Next: Phase 4 (Deeper teaching features)

Per BUILD.md 13: Tracer and the Trace tab (variable watch, trace table,
"trace this test case"), concept cards with runnable snippets and the
`/concepts` route (38 concept cards already exist in the database from
this phase, just not surfaced as a browsable page yet), Diagnose
(flag-a-line-and-pick-a-type) and the Predict-first prompt (the
`predict_prompt_md` field already exists on puzzles and is already
authored for several of them, just not wired into the player UI).
