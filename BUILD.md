# BUILD.md: BugHunt (working title)

A browser-based Python debugging game for post-16 students. Each puzzle gives the student broken Python code. They run it, read the evidence, find the fault, fix it, and prove the fix with test cases. Python runs in the browser (Pyodide), so runs are fully interactive, including `input()`. An admin can author new puzzles and publish them to a MySQL database.

This file is the working brief for a Claude agent. Read all of it before writing code. Section 13 gives the build order.

---

## 1. Purpose and audience

- **Users:** 16-19 year old students on NCFE Level 2 Understanding Coding, BTEC Level 3 and T-Level Digital Software Development courses, plus anyone learning Python from the public toolsforteaching.co.uk site.
- **Goal:** teach debugging as a skill, not just reward fixing. Students should leave each puzzle knowing why the bug happened and how to spot it next time.
- **Difficulty arc:** basic syntax errors first, then runtime crashes, then wrong answers from simple logic, then subtle logic errors, then multi-bug programs.
- **Public and open source.** No student accounts, no tracking, no personal data.

## 2. Decisions already made

These came from the project owner. Do not reopen them.

| Topic | Decision |
|---|---|
| Student identity | Anonymous. Progress lives in `localStorage` only. Admin login only. |
| Validation | Test cases per puzzle (visible and hidden), run in the browser by the Python runtime. |
| Learning supports | All four are in scope: tiered hints, post-solve explanation, error message decoder, trace table with variable watch. |
| Hosting | Hostinger, public facing. Same-origin in production. |
| Licence | Creative Commons BY-NC-SA 4.0 International. See section 12. |
| Target language | Python only. |
| Stack | React + Vite + JavaScript + Axios + PHP + MySQL. No TypeScript. |
| Editor | Monaco. |
| Interpreter | Pyodide (CPython compiled to WebAssembly), in a Web Worker. |

---

## 3. Teaching design (highest priority)

Teaching is the product. Every screen should make the method visible. If a feature choice is between "more game" and "clearer teaching", choose teaching.

### 3.1 Principles

1. **Method over answer.** Students learn a repeatable process. Fixing the bug is the outcome, not the lesson.
2. **Evidence first.** Students read errors, output and variable values before they change code.
3. **Explain every bug.** After each solve, show what the bug was, why Python behaved that way, and how to spot it next time.
4. **Hints cost something, but never block.** A student can always get unstuck.
5. **No spoilers from tools.** The error decoder and trace tools explain general behaviour. They never reveal a puzzle's specific fix.
6. **Low stakes.** Failed runs are free. Nothing is public. No leaderboards.

### 3.2 The Debugging Loop (always visible on the puzzle page)

A six-step stepper in the left panel. It is guidance, not a gate. Steps tick automatically from student actions, and each step has a one-line description and a "what good looks like" tooltip.

| Step | Prompt | Auto-ticks when |
|---|---|---|
| 1. Reproduce | Run it. What actually happens? | First Run or Run tests |
| 2. Read | Read the error or the wrong output. Start at the bottom of a traceback. | A run produced an error or a failed test, and the student opened the Explainer or Tests tab |
| 3. Locate | Narrow it down. Which line or block is suspect? | Student flags a suspect line (Diagnose), or uses Trace |
| 4. Hypothesise | Say what you think is wrong, in one sentence. | Optional note field has text, or Diagnose submitted |
| 5. Fix | Change one thing. | Editor content differs from the original |
| 6. Verify | Run all tests. Think about edge cases. | All tests pass |

Name the techniques the loop teaches, and link each to a concept card: reading tracebacks bottom up, print debugging, trace tables, rubber-duck explanation (the hypothesis box), divide and conquer (comment out half), boundary value checks, making a minimal example.

### 3.3 Learning supports per puzzle

**Tiered hints (3 tiers).**
- Tier 1, nudge: where to look, or which kind of bug.
- Tier 2, pointer: the line or block, and the category.
- Tier 3, near-answer: describes the fix in words, not code.
- Revealing a hint reduces XP (section 3.5). Hints unlock in order.

**Post-solve explanation.** Shown after a pass, or after "Give up". Contains:
- What each bug was, with the bug lines highlighted in Monaco (from `bh_puzzle_bugs`).
- Why Python behaved that way.
- "Spot it next time": a short checklist or habit.
- The fixed code, side by side with the student's code.
- Links to the relevant concept cards.

**Error message decoder.** When a run raises, the Error Explainer tab shows:
- The traceback split into parts: exception type, message, line number, call chain. Highlight the last line and tell the student to start there.
- A plain-English meaning of the exception type and message pattern.
- Common causes (2 to 4 bullets).
- "Where to look" advice.
- A Monaco squiggle on the reported line.
- A link to the matching concept card.
Implemented as a static pattern table in `src/python/errorDecoder.js` (section 4.7).

**Trace table and variable watch.** A "Trace" button re-runs the code with a line tracer (section 4.6):
- Step forward and back with a scrubber, or auto-play.
- The current line is highlighted in the editor.
- A variable watch panel shows values at the current step. Changed values flash (respect reduced motion).
- A trace table view (rows = steps, columns = variables) that students can copy. This maps directly onto the trace-table tasks in their courses.
- Students can trace a chosen test case, not just the free run.

**Concept cards.** Short lessons (markdown) with runnable "Try it" snippets, one per bug concept. They are linked from hints, the error decoder, the stepper and post-solve explanations. Each card follows the same shape: What it is, What it looks like when it goes wrong, How to spot it, How to fix it, Try it. Also browsable at `/concepts`.

**Diagnose before you fix (optional step).** A "Flag suspect line" action (click the gutter, or a button using the cursor line) plus a bug-type picker (syntax, runtime, logic). Checked against `bh_puzzle_bugs` at solve time. Correct diagnosis earns bonus XP and teaches locating, which is the hardest skill.

**Predict first (logic puzzles, Phase 4).** If a puzzle has `predict_prompt_md`, ask "What do you expect this to print or return for X?" before the first run. After the run, show whether the prediction matched. This builds the habit of comparing expectation with reality.

### 3.4 Tracks and progression

Five tracks, unlocked in order but all visible. A student may skip ahead with a "Show me anyway" link. Each track has an intro (markdown) saying what the student will learn.

| # | Track | Bug focus | Difficulty | Technique introduced |
|---|---|---|---|---|
| 1 | Spot the Typo | Syntax | 1-2 | Reading `SyntaxError` and `IndentationError` messages |
| 2 | Crash Course | Runtime errors | 1-3 | Reading tracebacks bottom up, error types |
| 3 | Wrong Answer | Simple logic | 2-3 | Expected vs actual, print debugging, boundary values |
| 4 | Deep Bugs | Subtle logic | 3-5 | Trace tables, state and scope, aliasing, recursion |
| 5 | Boss Fights | Mixed, 2 to 4 bugs, 30 to 100 lines | 4-5 | Divide and conquer, minimal examples, full loop |

The seed list of puzzles and concepts is in Appendix A.

Track 1 and 2 set `assist_level` to `none` or `basic`: bracket and quote auto-closing is off in Monaco so students feel the syntax errors. Later tracks use `full`.

### 3.5 Scoring and ranks

Keep values in `src/config/scoring.js` and make them overridable from `.config.json` (via the public-config endpoint).

- Base XP by difficulty 1 to 5: 10, 20, 35, 55, 80 (admin can override per puzzle).
- Hint penalty (cumulative): tier 1 −15%, tier 2 −25%, tier 3 −40%, capped at a 60% total reduction. Giving up awards 0 XP but still shows the explanation.
- Bonuses: correct diagnosis +20%, "clean solve" (three or fewer test runs) +10%.
- No speed bonus. Speed rewards guessing.
- Ranks by total XP: Hatchling, Beetle, Ladybird, Hornet, Mantis, Exterminator (thresholds in config).
- Badges (examples): First Fix, Read the Error (a Track 1 or 2 puzzle solved with no hints), Trace Master (solved a logic puzzle after using Trace), Track Complete (per track), No Hints Track, Boss Slayer, Streak (3 days in a row).

---

## 4. Architecture

### 4.1 Stack

- React + Vite (project created from `npm create vite@latest`, JavaScript, React template). React code in the project root, backend in `/api`.
- React Router for routes. Axios for all HTTP. JSDoc comments on all exported functions, components and hooks.
- `@monaco-editor/react` with Monaco bundled locally (no CDN at runtime).
- `pyodide`, self-hosted from `public/pyodide/`. Pin the current stable release when scaffolding, and record the version in `.config.json` and in README. The Python version follows Pyodide, and traceback message wording follows the Python version, so the error decoder must be tested against the pinned build.
- Markdown rendering: `react-markdown` with no raw HTML. Sanitise anything that could carry markup.
- PHP 8.x with PDO and prepared statements. MySQL (utf8mb4).
- One CSS file: `src/index.css`. Delete `App.css` from the template. Avoid inline styles.
- Fonts: Trebuchet MS for UI text. Courier New for code (Monaco `fontFamily`, user-adjustable in Settings).
- When the project is first created, install the react-doctor skill: `npx -y react-doctor@latest install` (pre-approved). Follow its guidance during the build.

### 4.2 Folder layout

```
/                          (project root, Vite template layout)
  index.html
  package.json
  vite.config.js
  .htaccess                (section 10)
  .config.json             (gitignored, secrets)
  .config.example.json     (committed, no secrets)
  LICENSE.md
  README.md
  BUILD.md
  scripts/
    copy-pyodide.mjs       (postinstall: copies runtime files into public/pyodide)
  public/
    pyodide/               (generated, gitignored)
  src/
    main.jsx
    App.jsx
    index.css
    api/
      client.js            (axios instance, bearer interceptor for admin)
      puzzles.js
      admin.js
    python/
      pyodide.worker.js    (worker entry)
      runner.js            (main-thread wrapper, promise API, timeouts)
      harness.py           (imported with ?raw, loaded into Pyodide)
      tracer.py            (imported with ?raw)
      errorDecoder.js
      errorFixtures.js     (sample errors for smoke testing the decoder)
    editor/
      monacoSetup.js       (local bundle, Python language only, workers)
      CodeEditor.jsx
    components/            (Console, TestResults, HintPanel, DebugLoopStepper,
                            TracePanel, VariableWatch, TraceTable, ErrorExplainer,
                            ExplanationPanel, ConceptCard, DiagnosePanel,
                            XpBar, BadgeToast, Markdown, RunnableSnippet)
    pages/                 (Home, Track, Puzzle, Concepts, Concept, Playground,
                            Progress, About, admin/*)
    store/
      progress.js          (localStorage, versioned, try/catch everywhere)
      settings.js
    config/
      scoring.js
  api/
    .htaccess
    cors.php
    db.php
    config.php
    lib/                   (response.php, auth.php, validate.php, markdown-safe helpers)
    public-config.php
    tracks.php
    puzzles.php
    puzzle.php
    hint.php
    solution.php
    concepts.php
    concept.php
    admin/                 (login.php, logout.php, me.php, puzzles.php, puzzle.php,
                            tracks.php, concepts.php, export.php, import.php, verify.php)
    sql/
      schema.sql
      seed.sql
      .htaccess            (deny all)
    tools/
      create_admin.php     (CLI only)
```

### 4.3 Python runtime

Run Pyodide in a dedicated module Web Worker. The worker has no DOM, no cookies and no access to `localStorage` or the admin token. The server never executes student code.

**Read the current Pyodide documentation for the pinned version** before coding the stdout, stderr, stdin and interrupt calls. Those APIs change between releases, so treat the message design below as the contract and the Pyodide calls as details to verify.

Main thread wrapper (`runner.js`) exposes promise-based functions: `init()`, `run(code, opts)`, `runTests(code, puzzle, handlers)`, `trace(code, opts)`, `interrupt()`.

Messages, main thread to worker:

| type | payload |
|---|---|
| `init` | `{ pyodideUrl, harnessSource, tracerSource, stdinBuffer?, interruptBuffer? }` |
| `run` | `{ code, mode: 'script' }` |
| `runTests` | `{ code, entryMode, entryName, tests[] }` |
| `trace` | `{ code, maxSteps, call? }` |
| `stdinLine` | `{ text }` (fallback path only) |

Messages, worker to main thread:

| type | payload |
|---|---|
| `ready` | |
| `stdout` / `stderr` | `{ text }` (batched) |
| `stdinRequest` | `{ prompt }` |
| `testStart` | `{ index }` |
| `testResult` | `{ index, passed, expected, actual, stdout, error, ms }` |
| `result` | `{ ok, error? }` where `error = { type, message, line, col, traceback }` |
| `traceResult` | `{ steps[], truncated }` |

**Limits (from `.config.json` via public-config):**
- Per-run and per-test timeout, default 5 seconds. The main thread starts the timer on `testStart`, so one hanging test reports "timed out on test N" instead of killing the whole batch.
- Output cap, default 20,000 characters. Stop and say so.
- Code size cap, default 20 KB.
- Standard library only. Allow-list of importable modules (suggested: `math`, `random`, `string`, `collections`, `itertools`, `functools`, `datetime`, `statistics`, `re`, `json`). Block `micropip` and package loading. Puzzle authors should seed `random` for repeatability.

**Interrupting a runaway loop.**
- Preferred path: `SharedArrayBuffer` interrupt buffer, which raises `KeyboardInterrupt` without losing the loaded runtime.
- Fallback: terminate the worker and start a new one, showing "Restarting Python" while it reloads.

**Interactive `input()`.**
- Preferred path: when `crossOriginIsolated` is true, the worker blocks on a `SharedArrayBuffer` with `Atomics.wait`. The Console component shows the prompt inline and the student types an answer, like a real terminal.
- Fallback when not isolated: an "Inputs" textbox where the student pre-types one line per `input()` call, with a clear message explaining why. Do not silently fail.
- Both paths must be built and tested. The isolation headers are set in `.htaccess` and in `vite.config.js` `server.headers` (section 10).

**Startup.** Load lazily on first need. Show a progress message ("Starting Python, first load is the slowest"). Keep the worker warm between runs. Each run executes in a fresh namespace so state never leaks between runs.

### 4.4 Monaco setup

- Import only the editor core and the Python basic-language contribution, not the whole package. Configure `loader.config({ monaco })` so nothing loads from a CDN.
- Provide the editor worker through Vite's `?worker` import.
- Features to wire up:
  - Error squiggles from tracebacks via `setModelMarkers`.
  - Current-line highlight and glyph for the trace step.
  - Gutter click to flag a suspect line (Diagnose).
  - Post-solve highlight of bug lines from `bh_puzzle_bugs`.
  - A diff view (`DiffEditor`) for student code vs fixed code in the explanation.
  - Per-track assist level (auto-close, auto-indent, suggestions on or off).
  - Light, dark and high-contrast themes. Font size setting.
- Keyboard accessibility: document the Monaco "toggle tab key moves focus" shortcut (Ctrl+M on Windows and Linux) on the puzzle page so keyboard users are never trapped.

### 4.5 Test harness spec

`harness.py` runs inside Pyodide. For every test:

1. Create a fresh namespace dict. Name it `__main__` in script mode (so `if __name__ == "__main__"` runs) and `student` in function mode.
2. Replace stdin with the test's `stdin_text`, or with the interactive reader in free-run mode. Capture stdout and stderr.
3. `compile(code, '<student>', 'exec')`, then `exec` in the namespace.
4. Function mode: look up `entry_name`. If it is missing, fail with a clear message ("Your code must define a function called `x`"). Evaluate `args_py` and `kwargs_py` with `ast.literal_eval`, then call the function.
5. Compare according to `expect_kind` and `compare_mode`.
6. Return a result object. For hidden tests, the front end shows only label, pass or fail, and a generic message. Visible tests show input, expected, actual and a diff.

Expectation kinds:

| `expect_kind` | `expect_py` | Notes |
|---|---|---|
| `returns` | Python literal | Compared with `==`. `float_tol` uses `math.isclose` (rel 1e-9). |
| `stdout` | String literal | `trim_stdout` strips trailing whitespace per line and at end. `exact_stdout` does not. |
| `raises` | Exception class name, e.g. `ValueError` | Passes only if that exception type is raised. |

Authoring guidance for tests (also shown in the admin UI):
- At least 4 tests per puzzle, and at least 2 hidden for logic puzzles, to catch hard-coded answers.
- Always include boundary cases: empty input, zero, one item, maximum, negative.
- Because validation is client-side, hidden tests are sent to the browser. This is fine for a teaching tool with no leaderboard. Say so in README. The reference solution is not sent with the puzzle (section 5.3).

### 4.6 Tracer

`tracer.py` uses `sys.settrace` and records events only for frames whose filename is `<student>`:

```
{ step, event: 'line'|'call'|'return'|'exception', line, depth, locals: {name: shortRepr}, stdoutLen }
```

- Truncate each `repr` to about 80 characters. Skip modules, functions and other noise from the locals snapshot.
- Hard cap, default 2,000 steps, then set `truncated: true` and say so in the UI. Allow "trace from line N" and "trace this test case" to focus the window.
- The trace table groups steps by variable and shows a new row per executed line. Make it copyable as plain text and as a table.
- Always remove the trace function in a `finally` block.

### 4.7 Error decoder

`errorDecoder.js` exports `decodeError({ type, message, line, traceback }, code)` returning `{ title, plain, causes[], whereToLook, conceptSlug }`.

- Match on exception type first, then on message patterns. Cover at least: `SyntaxError` (expected ':', unterminated string, was never closed, invalid syntax, cannot assign / "Maybe you meant '=='", invalid decimal literal, missing comma), `IndentationError` (expected an indented block, unexpected indent, unindent does not match), `NameError`, `UnboundLocalError`, `TypeError` (unsupported operand, can only concatenate, not callable, wrong argument count, not subscriptable), `ValueError`, `IndexError`, `KeyError`, `AttributeError` (including `NoneType`), `ZeroDivisionError`, `RecursionError`, `StopIteration`, `KeyboardInterrupt` (our timeout), `EOFError` (input with no data), `ModuleNotFoundError` for blocked imports.
- Wording is plain English for a 16 year old. Explain the idea, not the fix.
- Verify every pattern against real output from the pinned Pyodide build. Keep `errorFixtures.js` with a sample error per pattern, and use it in a smoke test page (`/dev/errors`, development only) that renders every decoded result.

---

## 5. Backend

### 5.1 Config

Single `.config.json` in the project root, read by `api/config.php`. Never committed. Ship `.config.example.json`.

```json
{
  "db": { "host": "localhost", "name": "bughunt", "user": "root", "pass": "" },
  "app": {
    "title": "BugHunt",
    "pyodideVersion": "FILL_AT_SCAFFOLD",
    "runTimeoutMs": 5000,
    "maxOutputChars": 20000,
    "maxCodeBytes": 20480,
    "allowedImports": ["math", "random", "string", "collections", "itertools", "functools", "datetime", "statistics", "re", "json"],
    "scoring": {}
  },
  "auth": { "tokenTtlHours": 8, "maxLoginAttemptsPer15Min": 8 }
}
```

`public-config.php` returns only the `app` block. Secrets never leave the server.

The frontend needs to know where the API is before it can ask for config. Use `VITE_API_BASE_URL` in `.env.development` (for example the Laragon URL), defaulting to `/api` in production. This is the one setting that cannot live in `.config.json`. Note it in README.

### 5.2 Conventions

- Every endpoint starts with `require_once __DIR__ . '/cors.php';` then `require_once __DIR__ . '/db.php';`. Never inline CORS headers. Admin endpoints use `__DIR__ . '/../cors.php'`.
- PHPDoc on every function and file.
- Response envelope: `{ "ok": true, "data": ... }` or `{ "ok": false, "error": { "code": "...", "message": "..." } }`, with correct HTTP status codes. Validate and bound all input. PDO prepared statements only.
- `api/cors.php` (per project standard):

```php
<?php
/**
 * Shared CORS handling. Include first in every endpoint.
 * Reflects the Origin header back only for localhost on any port.
 */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && preg_match('#^https?://localhost(:\d+)?$#', $origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}
```

- Auth for admin: opaque random bearer token (not cookies, which would need credentialed CORS). `login.php` verifies `password_verify`, creates a token with `random_bytes(32)`, stores only its SHA-256 hash with an expiry, and returns the raw token once. The front end keeps it in `sessionStorage` and Axios adds `Authorization: Bearer ...`. Rate-limit logins by IP using `bh_login_attempts`.
- Apache can drop the `Authorization` header before PHP sees it. `api/.htaccess` restores it (section 10).

### 5.3 Endpoints

Public (read-only, no auth):

| Method | Path | Returns |
|---|---|---|
| GET | `/api/public-config.php` | Safe config subset |
| GET | `/api/tracks.php` | Published tracks with puzzle counts and order |
| GET | `/api/puzzles.php?track=slug` | Puzzle list: slug, title, difficulty, bug_type, xp. No code. |
| GET | `/api/puzzle.php?slug=` | Brief, buggy code, entry mode and name, tests (hidden ones flagged `hidden: true`), hint count and costs, bug_count, predict prompt, concept slugs |
| GET | `/api/hint.php?slug=&tier=` | One hint's markdown |
| GET | `/api/solution.php?slug=` | Fixed code, bugs (line ranges, descriptions), explanation, spot-it text |
| GET | `/api/concepts.php`, `/api/concept.php?slug=` | Concept list and one lesson |

The solution and hints are separate calls so the student's browser only fetches them when asked. This is a soft control, not security, and README should say so.

Admin (Bearer token required):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/login.php` | Log in |
| POST | `/api/admin/logout.php` | Revoke token |
| GET | `/api/admin/me.php` | Check session |
| GET, POST | `/api/admin/puzzles.php` | List all (incl. drafts), create |
| GET, PUT, DELETE | `/api/admin/puzzle.php?id=` | Read, update, delete (with child rows) |
| GET, POST, PUT, DELETE | `/api/admin/tracks.php`, `/api/admin/concepts.php` | CRUD |
| POST | `/api/admin/verify.php` | Record a successful in-browser verification (hash) |
| GET | `/api/admin/export.php` | JSON bundle of tracks, concepts, puzzles |
| POST | `/api/admin/import.php` | Import a bundle (validate, then upsert by slug) |

A puzzle cannot move to `published` unless `verified_hash` matches the current hash of `buggy_code + fixed_code + tests + entry settings`. Editing any of those clears verification.

---

## 6. Database schema

Put this in `api/sql/schema.sql`. Table prefix `bh_`. InnoDB, utf8mb4.

```sql
CREATE TABLE bh_admins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL
);

CREATE TABLE bh_admin_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES bh_admins(id) ON DELETE CASCADE
);

CREATE TABLE bh_login_attempts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (ip, attempted_at)
);

CREATE TABLE bh_tracks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  summary VARCHAR(255) NOT NULL DEFAULT '',
  intro_md TEXT NULL,
  bug_focus ENUM('syntax','runtime','logic','mixed') NOT NULL,
  assist_level ENUM('none','basic','full') NOT NULL DEFAULT 'full',
  sort_order SMALLINT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft'
);

CREATE TABLE bh_concepts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(120) NOT NULL,
  summary VARCHAR(255) NOT NULL DEFAULT '',
  lesson_md MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE bh_puzzles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  track_id INT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  difficulty TINYINT UNSIGNED NOT NULL,            -- 1 to 5
  xp SMALLINT UNSIGNED NULL,                        -- NULL = use default for difficulty
  bug_type ENUM('syntax','runtime','logic','mixed') NOT NULL,
  brief_md TEXT NOT NULL,                           -- what the code is meant to do
  buggy_code MEDIUMTEXT NOT NULL,
  fixed_code MEDIUMTEXT NOT NULL,
  entry_mode ENUM('function','script') NOT NULL DEFAULT 'function',
  entry_name VARCHAR(64) NULL,
  explanation_md TEXT NOT NULL,
  spot_it_md TEXT NULL,
  predict_prompt_md TEXT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  verified_hash CHAR(64) NULL,
  verified_at DATETIME NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (track_id) REFERENCES bh_tracks(id),
  FOREIGN KEY (created_by) REFERENCES bh_admins(id) ON DELETE SET NULL
);

CREATE TABLE bh_puzzle_tests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  puzzle_id INT UNSIGNED NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  label VARCHAR(160) NOT NULL,
  args_py TEXT NULL,                                -- Python literal, tuple of positional args
  kwargs_py TEXT NULL,                              -- Python literal, dict
  stdin_text TEXT NULL,
  expect_kind ENUM('returns','stdout','raises') NOT NULL,
  expect_py TEXT NOT NULL,
  compare_mode ENUM('exact','float_tol','trim_stdout','exact_stdout') NOT NULL DEFAULT 'exact',
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (puzzle_id) REFERENCES bh_puzzles(id) ON DELETE CASCADE
);

CREATE TABLE bh_hints (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  puzzle_id INT UNSIGNED NOT NULL,
  tier TINYINT UNSIGNED NOT NULL,                   -- 1 to 3
  hint_md TEXT NOT NULL,
  UNIQUE (puzzle_id, tier),
  FOREIGN KEY (puzzle_id) REFERENCES bh_puzzles(id) ON DELETE CASCADE
);

CREATE TABLE bh_puzzle_bugs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  puzzle_id INT UNSIGNED NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  line_start SMALLINT UNSIGNED NOT NULL,
  line_end SMALLINT UNSIGNED NOT NULL,
  bug_type ENUM('syntax','runtime','logic') NOT NULL,
  concept_id INT UNSIGNED NULL,
  what_md TEXT NOT NULL,                            -- what was wrong and why
  fix_md TEXT NOT NULL,                             -- how to fix it
  FOREIGN KEY (puzzle_id) REFERENCES bh_puzzles(id) ON DELETE CASCADE,
  FOREIGN KEY (concept_id) REFERENCES bh_concepts(id) ON DELETE SET NULL
);

CREATE TABLE bh_puzzle_concepts (
  puzzle_id INT UNSIGNED NOT NULL,
  concept_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (puzzle_id, concept_id),
  FOREIGN KEY (puzzle_id) REFERENCES bh_puzzles(id) ON DELETE CASCADE,
  FOREIGN KEY (concept_id) REFERENCES bh_concepts(id) ON DELETE CASCADE
);
```

`api/tools/create_admin.php` is a CLI-only script (refuse to run under a web SAPI) that prompts for a username and password and inserts an admin with `password_hash`.

---

## 7. Puzzle format and worked example

Export, import and the seed file all use the same JSON shape. One puzzle:

```json
{
  "slug": "sum-to-n-off-by-one",
  "track": "wrong-answer",
  "title": "The Missing Number",
  "difficulty": 2,
  "bug_type": "logic",
  "entry_mode": "function",
  "entry_name": "sum_to",
  "brief_md": "`sum_to(n)` should return the sum of all whole numbers from 1 up to and including `n`.\n\nExample: `sum_to(4)` should return `10` (1 + 2 + 3 + 4).",
  "buggy_code": "def sum_to(n):\n    total = 0\n    for i in range(1, n):\n        total += i\n    return total\n",
  "fixed_code": "def sum_to(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n    return total\n",
  "predict_prompt_md": "What do you think `sum_to(4)` returns? Write it down before you run anything.",
  "tests": [
    { "label": "sum_to(4)", "args_py": "(4,)", "expect_kind": "returns", "expect_py": "10", "hidden": false },
    { "label": "sum_to(1)", "args_py": "(1,)", "expect_kind": "returns", "expect_py": "1", "hidden": false },
    { "label": "sum_to(0)", "args_py": "(0,)", "expect_kind": "returns", "expect_py": "0", "hidden": true },
    { "label": "sum_to(100)", "args_py": "(100,)", "expect_kind": "returns", "expect_py": "5050", "hidden": true }
  ],
  "hints": [
    { "tier": 1, "hint_md": "The code runs without errors, so this is a logic bug. Compare your result for `sum_to(4)` with 10." },
    { "tier": 2, "hint_md": "Look at the `range()` call. Which numbers does `range(1, n)` actually produce?" },
    { "tier": 3, "hint_md": "`range` stops one short of its second value. You need the loop to reach `n` itself." }
  ],
  "bugs": [
    {
      "line_start": 3, "line_end": 3, "bug_type": "logic", "concept": "off-by-one",
      "what_md": "`range(1, n)` stops at `n - 1`, so `n` is never added.",
      "fix_md": "Use `range(1, n + 1)`."
    }
  ],
  "concepts": ["off-by-one", "range-function"],
  "explanation_md": "Python's `range(a, b)` includes `a` but excludes `b`. ...",
  "spot_it_md": "Any time you loop with `range`, check the first and last values by hand with a tiny input like `n = 1` or `n = 2`."
}
```

Puzzle authoring rules (show these in the admin editor):
- One bug per puzzle through Track 3. Two or more only in Tracks 4 and 5.
- The brief must say what the code should do and give at least one worked example.
- Bugs should look like mistakes real students make. No trick puzzles.
- Starter code should be the smallest program that shows the bug. Rough size guide: Track 1, 3 to 10 lines. Track 2, 5 to 15. Track 3, 8 to 20. Track 4, 10 to 30. Track 5, 30 to 100.
- Do not leave comments that reveal the bug.
- Syntax puzzles: the buggy code must fail to compile, and tests are mainly about running correctly after the fix.

---

## 8. Admin app

Routes under `/admin`, guarded by a session check against `me.php`. Not linked from the public navigation, but linked from the footer as "Admin".

- **Login.** Username and password. Clear lockout message after too many attempts.
- **Puzzle list.** Filter by track, status, bug type, verified. Columns: title, track, difficulty, status, verified. Duplicate and delete (with confirm).
- **Puzzle editor.** Sections, top to bottom:
  1. Metadata (title, slug auto-generated and editable, track, difficulty, XP override, bug type, entry mode and name).
  2. Brief (markdown with live preview).
  3. Buggy code (Monaco) and fixed code (Monaco), with a diff toggle.
  4. Bugs list: add a bug by selecting lines in the buggy-code editor; attach a type, concept, "what" and "fix" text.
  5. Tests table: add, reorder, mark hidden. A "Capture from fixed code" helper runs the fixed code with an entered input and pre-fills the expected value, which the admin then confirms by eye.
  6. Hints (three fields), explanation, spot-it text, optional predict prompt.
  7. Concepts multi-select.
- **Verify button.** Runs in the browser with the same runner students use:
  - Fixed code must pass every test.
  - Buggy code must fail at least one test (and for syntax puzzles, must fail to compile).
  - Buggy and fixed code must differ.
  - Each declared bug must have line numbers inside the buggy code.
  - Warnings (not blockers): fewer than 4 tests, no hidden tests on a logic puzzle, no hints, no explanation, hint text that contains the fixed line verbatim.
  On success, call `verify.php` to store the hash. Publishing is disabled until verified. Editing relevant fields clears the verification.
- **Preview as student.** Opens the real puzzle page in preview mode using the draft, with progress saving disabled.
- **Tracks and concepts.** Simple CRUD forms. The concept editor has a markdown preview and supports runnable snippets (see below).
- **Import and export.** Download or upload the JSON bundle. This lets other teachers share puzzle packs. Imports are validated and show a diff of what will change before applying.
- **Stretch goal:** a "suggest a bug" helper that proposes mutations of the fixed code (flip `<` and `<=`, drop a colon, change `+ 1`, swap `and` and `or`) for the admin to accept or edit.

Runnable snippets in markdown: use a fenced block marked ` ```python run ` to render a small editor with a Run button inside concept cards and explanations. They use the same runner and the same limits.

---

## 9. Student-facing UI

### 9.1 Routes

`/` home (track map, rank, XP) · `/track/:slug` · `/puzzle/:slug` · `/concepts` · `/concepts/:slug` · `/playground` · `/progress` · `/about` (licence, privacy, how it works) · admin routes (section 8). Puzzle and concept URLs are stable deep links, so a teacher can set a single puzzle as homework by sharing the link.

### 9.2 Puzzle page layout

```
+------------------------------------------------------------------+
| BugHunt  > Track > Puzzle title            XP bar  Rank  Settings |
+-----------------+---------------------------+--------------------+
| BRIEF           |  MONACO EDITOR            | TABS               |
| what the code   |  starter code, gutter     | Console            |
| should do       |  click flags a suspect    | Tests              |
|                 |  line                     | Trace + Watch      |
| DEBUGGING LOOP  |                           | Error Explainer    |
| 1 Reproduce     |                           |                    |
| 2 Read          |                           |                    |
| 3 Locate  ...   |                           |                    |
| HINTS  1 2 3    |                           |                    |
| CONCEPTS        |                           |                    |
+-----------------+---------------------------+--------------------+
| Run | Run tests | Trace | Reset | Flag suspect line | Give up     |
+------------------------------------------------------------------+
```

On narrow screens the three columns stack, with the editor first and the left panel and tabs as collapsible sections. Console and Tests switch automatically when relevant but never steal keyboard focus.

### 9.3 Solve flow

1. Student reads the brief (and answers the predict prompt if present).
2. Runs the code and works through the loop.
3. "Run tests" shows each test with pass or fail, expected vs actual.
4. All pass: celebration (respect reduced motion), XP and badges awarded, explanation panel opens with the diff and highlighted bug lines, "Next puzzle" and concept links appear.
5. "Give up" asks for confirmation, then shows the explanation with 0 XP. The puzzle can be retried later for XP.

### 9.4 Progress storage

Key `bughunt.progress.v1`. Wrap every read and write in `try/catch` (storage can be empty, blocked or full). Version the shape and write a migration function when it changes.

```json
{
  "version": 1,
  "xp": 0,
  "badges": [],
  "streak": { "days": 0, "lastDate": null },
  "puzzles": {
    "sum-to-n-off-by-one": {
      "solvedAt": null, "attempts": 0, "testRuns": 0,
      "hintsUsed": [], "usedTrace": false,
      "diagnosis": { "line": null, "type": null, "correct": null },
      "xpAwarded": 0, "draftCode": null
    }
  }
}
```

- Autosave the student's draft code per puzzle.
- The Progress page offers Export (download JSON), Import (file picker, validate first), and Reset (with confirm). Tell students plainly that clearing browser data erases progress, and that export is their backup.
- The Settings panel (stored separately): theme, editor font size, font choice (Courier New default, with a dyslexia-friendly option), reduce motion, show line numbers.

---

## 10. Local development and deployment

### 10.1 Local (Laragon)

- Laragon (Apache on `localhost:80`) serves PHP and MySQL. Vite serves only the React frontend on its own port. No Vite proxy.
- If port 5173 is already in use, the Laragon-side dev instance is already running. Use that instance for testing. Do not kill it and start another.
- Frontend calls the API using `VITE_API_BASE_URL` pointing at the Laragon URL. `cors.php` reflects the `localhost:PORT` origin.
- Add to `vite.config.js`: `server.headers` with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (needed for `SharedArrayBuffer`), `worker.format: 'es'`, and `optimizeDeps.exclude: ['pyodide']`.
- Because the API is on a different origin in dev, check that COEP does not block API responses. If it does, add `Cross-Origin-Resource-Policy: cross-origin` in `cors.php` for dev only, and record that in README.

### 10.2 Root `.htaccess`

Use the standard fallback block, plus protection for `.config.json`, the WASM type, and the isolation headers.

```apache
RewriteEngine On

# Let real files/directories (including /api/*) resolve normally.
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

# Everything else falls back to index.html so React Router can handle
# client-side routes (e.g. a hard refresh).
RewriteRule ^ index.html [L]

# Never expose configuration or hidden files.
<FilesMatch "^\.(config|env|git)">
    Require all denied
</FilesMatch>
<Files ".config.json">
    Require all denied
</Files>
<Files ".config.example.json">
    Require all denied
</Files>

AddType application/wasm .wasm

# Cross-origin isolation, needed for SharedArrayBuffer (interactive input, interrupt).
<IfModule mod_headers.c>
    Header set Cross-Origin-Opener-Policy "same-origin"
    Header set Cross-Origin-Embedder-Policy "require-corp"
</IfModule>
```

Because the rewrite rules let any existing file resolve, the `Files` deny blocks are what actually protect `.config.json`. Test it: requesting `/.config.json` on the built site must return 403.

### 10.3 `api/.htaccess` and `api/sql/.htaccess`

```apache
# api/.htaccess
RewriteEngine On
RewriteCond %{HTTP:Authorization} ^(.*)
RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]

<IfModule mod_headers.c>
    Header set Cross-Origin-Resource-Policy "same-origin"
</IfModule>

<FilesMatch "^(config|db)\.php$">
    # These are includes, not endpoints.
    Require all denied
</FilesMatch>
```
```apache
# api/sql/.htaccess  (also tools/ and lib/)
Require all denied
```

Verify on Hostinger that `mod_headers` is active and that the isolation headers arrive. If the host will not send them, the app must still work through the fallback input path (section 4.3), and the Console should show a small, honest note about it.

### 10.4 Deploy to Hostinger

1. `npm run build`. Upload `dist/` contents to the web root along with `api/` and the root `.htaccess`.
2. Create the MySQL database, run `api/sql/schema.sql` then `seed.sql`.
3. Create `.config.json` on the server (outside Git). If the host allows it, keep a copy of `.config.json` one level above the web root and have `api/config.php` check there first.
4. Run `php api/tools/create_admin.php` from SSH, or insert an admin row by hand with a hash generated locally.
5. Check: home loads, hard refresh on `/puzzle/...` works, `/.config.json` returns 403, `crossOriginIsolated` is true in the browser console, admin login works.
6. Pin cache headers sensibly: long cache on hashed assets and the Pyodide files, no cache on `index.html`.

---

## 11. Accessibility, privacy and security

**Accessibility (target WCAG 2.1 AA).**
- Full keyboard operation. Document the editor focus escape key. Visible focus rings.
- Never rely on colour alone. Pass and fail use icons and text as well as colour.
- Test results and run status announce through an `aria-live` region.
- Contrast checked in all three themes. Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Target sizes of at least 44px for touch actions. Layout works at 320px width and at 200% zoom.
- Trace and watch panels have a text alternative (the trace table) so they never depend on animation.

**Privacy.**
- No analytics, no third-party scripts, no cookies, no fonts loaded from external hosts. Only `localStorage` for progress and settings. Student code never leaves the browser.
- The About page states this in plain language.

**Security.**
- Student code runs in a browser worker with no DOM. The server never runs it.
- Admin only: Argon2id or bcrypt via `password_hash`, hashed bearer tokens with expiry, login rate limiting, input length caps, prepared statements, JSON size cap on import.
- Render markdown without raw HTML. Escape everything else. Admin content is trusted but still sanitised, because bundles can be imported from elsewhere.
- Validate that `args_py`, `kwargs_py` and `expect_py` parse as Python literals during verification.

---

## 12. Licence

Release all code, puzzles and lesson content under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.

Put this precis in README and `LICENSE.md`, and link to the full legal text:

- **BY (Attribution):** you must credit the author, link to the licence, and say if you made changes.
- **NC (NonCommercial):** you may not use the work for commercial purposes.
- **SA (ShareAlike):** if you remix or build on it, you must share your version under the same licence.
- You may copy and redistribute it in any medium or format, and adapt it, within those terms.

Full terms: https://creativecommons.org/licenses/by-nc-sa/4.0/ and legal code at https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode

Note for the maintainer: Creative Commons itself advises against using its licences for software, because they do not address patents or source code distribution in the way software licences do. The choice stands as instructed. Add a `THIRD_PARTY.md` listing dependencies under their own licences (React, Vite, Axios, Monaco Editor, Pyodide, react-markdown, and others). Their licences continue to apply to those parts.

---

## 13. Build phases

Work in this order. Finish each phase's acceptance checks before starting the next. After each phase, stop and let the project owner supervise testing (section 14).

### Phase 0: Scaffold
- `npm create vite@latest` (React, JavaScript). Run `npx -y react-doctor@latest install`.
- Install dependencies. Merge `index.css` and `App.css` into one `src/index.css`.
- `scripts/copy-pyodide.mjs` postinstall, `vite.config.js` headers and worker settings.
- `api/` skeleton: `cors.php`, `config.php`, `db.php`, `lib/response.php`, `.htaccess` files, `public-config.php`. Root `.htaccess`. `.config.example.json`. `.gitignore`. `LICENSE.md` and README stub.
- **Accept:** `npm run dev` loads a blank shell, `public-config.php` returns JSON from the dev origin, `/.config.json` is denied.

### Phase 1: Python runtime and editor (vertical slice)
- Monaco local setup, `CodeEditor`, `Console`. Worker, `runner.js`, run with stdout and stderr, timeout, output cap, interrupt.
- Interactive `input()` via the isolated path, plus the Inputs-box fallback.
- Error decoder with squiggles and the Error Explainer tab. Playground route using all of the above.
- **Accept:** a student can type code in `/playground`, run it, answer `input()` prompts, see a decoded error for each pattern in `errorFixtures`, and recover from `while True: pass`.

### Phase 2: Puzzle player
- Test harness, Tests tab, hidden test handling, per-test timeouts.
- Puzzle page layout, Debugging Loop stepper, tiered hints, post-solve explanation with diff and bug highlights, Give up flow.
- Scoring, ranks, badges, `localStorage` store, Progress page, export and import.
- For now, load puzzles from a local `src/dev/samplePuzzles.json` that matches the API shape, so the player can be built before the backend is.
- **Accept:** sample puzzles are playable end to end, XP and hints work, progress survives a refresh and an export/import round trip.

### Phase 3: Backend and admin
- Schema, seed of tracks and a few puzzles, public endpoints, switch the player to the API.
- Admin auth, create_admin tool, puzzle editor, verify flow, publish rules, tracks and concepts CRUD, import and export.
- **Accept:** admin can log in, author a puzzle with tests, hints and bugs, verify it, publish it, and see it appear for a student. Unverified puzzles cannot be published. Admin endpoints reject calls without a valid token.

### Phase 4: Deeper teaching features
- Tracer, Trace tab, variable watch, trace table, "trace this test case".
- Concept cards with runnable snippets, `/concepts`, links from hints and the decoder.
- Diagnose (flag line and type), Predict prompt.
- **Accept:** tracing a loop shows correct per-step values, the trace table copies cleanly, a concept snippet runs in place, diagnosis bonus is awarded only when correct.

### Phase 5: Content, accessibility, release
- Write the seed curriculum (Appendix A) as puzzles and concepts. Draft them, then **flag every item for teacher review**. The project owner is the subject expert.
- Accessibility pass against section 11. Settings panel, themes.
- README, About page, THIRD_PARTY.md, deploy notes, Hostinger deploy check (section 10.4).
- **Accept:** Appendix A tracks 1 and 2 fully seeded, release checklist passes on Hostinger.

---

## 14. Testing approach

- **Smoke test only** from the agent. After each phase, run the app, exercise the headline paths in that phase's acceptance list, and report what worked and what did not. Do not run long end-to-end suites.
- The project owner supervises and carries out all other testing unless a specific test is requested for an operation, module or function.
- Suggested, but do not run unprompted: a small Vitest suite for `errorDecoder.js`, `scoring.js` and the progress migration, and a Node script that verifies every seeded puzzle (fixed code passes, buggy code fails) using the same runner. Offer these at the end of Phase 3 and Phase 5 and wait for approval.
- Smoke checklist for any release candidate:
  1. Fresh load, no console errors, `crossOriginIsolated` reported.
  2. Playground: print, `input()`, syntax error, runtime error, infinite loop recovery.
  3. One puzzle per track: fail, hint, fix, pass, explanation.
  4. Trace a loop and read the table.
  5. Refresh keeps draft and progress. Export then import restores it.
  6. Admin: login, create, verify, publish, student sees it, logout.
  7. `/.config.json` denied, hard refresh on a deep route works.
  8. Keyboard-only pass through one puzzle.

---

## 15. Assumptions and open items

Flag these to the project owner when they come up. Do not guess silently.

- **App name and domain.** "BugHunt" is a placeholder. Subdomain or subfolder of toolsforteaching.co.uk is undecided. Assume the site root is `/`. If it ends up in a subfolder, add a `VITE_BASE` setting.
- **Pyodide hosting.** Self-hosting is assumed so the isolation headers work without cross-origin problems. If Hostinger payload size or limits cause trouble, revisit.
- **Isolation headers on Hostinger.** Unverified. The fallback input path exists for this reason.
- **Allowed imports.** The list in section 5.1 is a starting point.
- **Classroom features.** There is no teacher dashboard because there are no accounts. Possible later additions: a printable "progress certificate", or shareable puzzle set links (`?set=slug1,slug2`). Not in scope now.
- **Content authority.** All seed puzzles, hints and lessons are drafts until the project owner reviews them.

---

## Appendix A: Seed curriculum

Concept slugs are in `code`. Create one concept card per slug. Puzzle titles are working names.

### Track 1: Spot the Typo (syntax, difficulty 1-2)

| Puzzle | Bug | Concept |
|---|---|---|
| Missing Bracket | Unclosed `(` in `print` | `unclosed-brackets` |
| The Lonely Quote | Unterminated string | `strings-quotes` |
| Colon Needed | `if` or `for` without colon | `block-syntax` |
| Indentation Station | Body not indented | `indentation` |
| Mixed Signals | Tabs and spaces mixed | `indentation` |
| Capital Offence | `Print`, `true` | `case-sensitivity` |
| Single Equals | `if x = 5` | `assignment-vs-comparison` |
| Keyword Mixup | `elseif`, missing `in` | `keywords` |
| Wrong Brackets | `print["hi"]`, `list(1, 2)` | `bracket-types` |
| Unfinished Function | `def` missing parentheses or colon | `function-syntax` |

### Track 2: Crash Course (runtime errors, difficulty 1-3)

| Puzzle | Bug | Concept |
|---|---|---|
| Mystery Name | Misspelled variable (`NameError`) | `names-and-scope` |
| Text Plus Number | `"Age: " + 17` (`TypeError`) | `types-and-conversion` |
| Past the End | `lst[len(lst)]` (`IndexError`) | `indexing` |
| Missing Key | `d["colour"]` not present (`KeyError`) | `dictionaries` |
| Divide by Nothing | Average of an empty list | `zero-division-and-guards` |
| Not a Number | `int("3.5")`, `int("abc")` | `input-validation` |
| Nothing Returned | Function lacks `return`, result is `None` | `return-values` |
| Local Trouble | `UnboundLocalError` | `names-and-scope` |
| The String That Looked Like a Number | `input()` gives text | `types-and-conversion` |
| Wrong Number of Arguments | Call does not match definition | `function-calls` |

### Track 3: Wrong Answer (simple logic, difficulty 2-3)

| Puzzle | Bug | Concept |
|---|---|---|
| The Missing Number | `range(1, n)` | `off-by-one`, `range-function` |
| Fence Posts | `<` vs `<=` | `off-by-one` |
| Half a Result | `//` vs `/` | `integer-vs-float-division` |
| Average Trouble | `a + b / 2` | `operator-precedence` |
| And or Or | Wrong boolean operator in a validator | `boolean-logic` |
| Too Early to Return | `return` inside a loop | `loops-and-return` |
| Forgot to Reset | Accumulator initialised in the wrong place | `accumulators` |
| The Loop That Never Ends | Missing increment | `loop-termination` |
| Ten Is Less Than Nine | String comparison of numbers | `types-and-conversion` |
| Shadowed | A variable named `sum` or `list` | `shadowing-builtins` |
| Modify While Looping | Removing from a list during iteration | `mutating-while-iterating` |
| Case Matters | Counting vowels, ignoring uppercase | `string-methods` |

### Track 4: Deep Bugs (subtle logic, difficulty 3-5)

| Puzzle | Bug | Concept |
|---|---|---|
| Shared Default | Mutable default argument | `mutable-defaults` |
| Same List, Two Names | Aliasing instead of copying | `aliasing-and-copying` |
| Grid Surprise | `[[0] * 3] * 3` | `aliasing-and-copying` |
| Infinite Descent | Missing recursion base case | `recursion` |
| The Search That Hangs | Binary search with bad bounds | `binary-search`, `off-by-one` |
| Late Binding | Lambdas in a loop all see the last value | `closures` |
| Global Mistake | Local vs global state | `names-and-scope` |
| Used Up | Generator consumed twice | `iterators-and-generators` |
| Nearly Equal | `0.1 + 0.2 == 0.3` | `floating-point` |
| Changing While Iterating (dict) | Dict mutated during loop | `mutating-while-iterating` |
| Sorted Wrong | Wrong `key` or `reverse` | `sorting` |
| Silent Failure | Bare `except` hides the bug | `exception-handling` |
| Equal or Identical | `is` vs `==` | `identity-vs-equality` |

### Track 5: Boss Fights (mixed, difficulty 4-5, 2 to 4 bugs each)

| Puzzle | Typical bugs |
|---|---|
| Grade Calculator | Boundary at pass mark, empty list, integer division |
| Caesar Cipher | Wraparound, non-letters, upper vs lower case |
| Tic-Tac-Toe Winner | Missed diagonal, draw not detected |
| Bank Account | Shared class attribute, negative balance allowed |
| Inventory Manager | `KeyError`, stock updated twice, wrong total |
| Prime Sieve | Start index, inclusive upper bound |
| Merge Sort | Leftover items dropped, slice off-by-one |
| Linked List | Pointer updated in the wrong order |
| Text Statistics | Punctuation, empty input, word split |
| Shopping Cart | Discount precedence, float rounding |

### Concept list (all slugs above)

`unclosed-brackets`, `strings-quotes`, `block-syntax`, `indentation`, `case-sensitivity`, `assignment-vs-comparison`, `keywords`, `bracket-types`, `function-syntax`, `names-and-scope`, `types-and-conversion`, `indexing`, `dictionaries`, `zero-division-and-guards`, `input-validation`, `return-values`, `function-calls`, `off-by-one`, `range-function`, `integer-vs-float-division`, `operator-precedence`, `boolean-logic`, `loops-and-return`, `accumulators`, `loop-termination`, `shadowing-builtins`, `mutating-while-iterating`, `string-methods`, `mutable-defaults`, `aliasing-and-copying`, `recursion`, `binary-search`, `closures`, `iterators-and-generators`, `floating-point`, `sorting`, `exception-handling`, `identity-vs-equality`.

Technique cards (linked from the Debugging Loop): `reading-tracebacks`, `print-debugging`, `trace-tables`, `rubber-duck-debugging`, `divide-and-conquer`, `boundary-values`, `minimal-example`.
