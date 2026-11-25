# BugHunt

A browser-based Python debugging game for post-16 students such as those studying Level 2 Foundation, T-Level, GCSE, A-Level and BTec. Python runs
client-side in a Web Worker via Pyodide; a PHP/MySQL backend serves and
stores puzzles. See `BUILD.md` for the full brief, decisions and build
order.

## For Teachers

BugHunt isn't a quiz - every puzzle is real Python code with a real bug.
Students find it, fix it, and prove the fix works by passing a set of
tests. There's no multiple choice and nothing to guess; the only way
through is to actually read the code, run it, and reason about what it's
doing.

### How it's structured

Five tracks, in order of difficulty, 55 puzzles in total:

| Track | Bug type | Difficulty | What it teaches |
|---|---|---|---|
| Spot the Typo (10 puzzles) | Syntax | 1-2 | Reading `SyntaxError`/`IndentationError` messages |
| Crash Course (10 puzzles) | Runtime errors | 1-3 | Reading a traceback from the bottom up |
| Wrong Answer (12 puzzles) | Simple logic | 2-3 | Expected vs actual, checking boundary values |
| Deep Bugs (13 puzzles) | Subtle logic | 3-4 | Trace tables, state, scope, aliasing, recursion |
| Boss Fights (10 puzzles) | Mixed (2-4 bugs each) | 4-5 | Divide and conquer, working the full loop end to end |

All five tracks are visible from the start - students aren't locked out
of later tracks, so a class can be pointed straight at "Deep Bugs" if
that's what a scheme of work calls for that week.

Every puzzle walks the same six-step **Debugging Loop** (Reproduce, Read,
Locate, Hypothesise, Fix, Verify) - the same process professional
developers use, made explicit so it becomes a habit rather than
something students only do by accident.

### Tools students have, and when they help

- **Hints** - three tiers (nudge, pointer, near-answer), unlocked in
  order. Each one costs a bit of XP, so there's a reason to think first,
  but nothing is ever permanently locked behind them.
- **Error Explainer** - translates a Python traceback into plain English
  (what the exception means, common causes, where to look), with a link
  to the relevant concept card.
- **Trace** - steps through the code's actual execution line by line,
  with a variable watch and a trace table (one row per line executed,
  one column per variable). This maps directly onto the trace-table
  exercises in GCSE/A-level/T-Level specifications, and the table copies
  as plain tab-separated text straight into a spreadsheet or Word table.
- **Diagnose** ("Flag suspect line") - students name which line they
  think is wrong and what kind of bug it is before they've necessarily
  fixed it, which is deliberately the hardest skill to teach. Get it
  right and it's worth bonus XP.
- **Predict** - on puzzles that have it, students write down what they
  expect the code to do *before* running it, then compare against what
  actually happened. This is a self-check, not auto-graded - there's no
  "right answer" field to match against free text.
- **Concept cards** (`/concepts`) - a browsable glossary of every bug
  type covered (indentation, scope, mutable defaults, floating-point
  precision, and so on), each with a short explanation and a live
  runnable example. Worth pointing students at directly, independent of
  any puzzle.

### Setting homework

Every puzzle and concept has a stable, shareable URL
(`/puzzle/<slug>`, `/concepts/<slug>`) - paste one into a VLE/Teams/
Google Classroom post to set a single puzzle as homework, no login
required on the student's end.

### Accounts and data - what teachers need to know

**There are no student accounts.** A student's progress (XP, badges,
which puzzles are solved, hint usage) lives only in their browser's
`localStorage` - nothing is sent to or stored on the server. This means:

- Progress doesn't follow a student between devices or browsers, and
  clearing browser data erases it.
- There's no built-in gradebook or class view - you can't currently see
  a roster of who's done what from the admin side.
- The Progress page (`/progress`) has **Export** and **Import** buttons.
  If you need evidence of work done, or want students to move their
  progress to a different machine, have them export the JSON file - as
  a file submission, or as a backup before a shared-computer session
  ends.
- No analytics, no cookies, no third-party scripts, no accounts to leak
  - student code and progress never leave the browser. Useful to know
  for a data-protection/safeguarding conversation, since there's
  nothing to disclose.

### The admin area (for content, not students)

`/admin` is for staff authoring and managing puzzles - students never
see it or need it. Two roles:

- **Admin** - everything a teacher can do, plus creating/deleting other
  staff accounts.
- **Teacher** - author, verify and publish puzzles, tracks and concepts;
  cannot manage accounts.

The first admin account is created from the command line (not through
the web UI, deliberately - see `api/tools/create_admin.php`):

```
php api/tools/create_admin.php
```

It'll prompt for a username, password and role. An admin can create
further teacher accounts from `/admin/accounts` once logged in. Every
account can change its own password from `/admin/password`.

Authoring a puzzle: fill in the metadata, brief, buggy/fixed code, tests,
hints and bugs, then click **Verify** - this actually runs the code
through the same Python runtime students use, checking the fixed code
passes every test and the buggy code genuinely fails at least one.
**Publish is blocked until a puzzle verifies clean**, and editing the
code or tests afterwards un-verifies it again, so a published puzzle on
the live site has always passed this check. Export/Import on the puzzle
list lets you share a whole content pack as a JSON file with another
teacher or another install.

## Quick start

```
npm install
npm run dev
npm test
npm run build
```

`npm install` also copies the Pyodide runtime files into `public/pyodide`
(via `scripts/copy-pyodide.mjs`, run as a `postinstall` step).

### Backend (local dev)

The frontend talks to the PHP API over HTTP; there is no Vite proxy. Set
`VITE_API_BASE_URL` in `.env.development` to wherever PHP is serving `/api`.

This machine (home) runs Laragon: Apache on `localhost:80`, with the
document root repointed directly at this project folder (so
`http://localhost/api/...` serves `api/` as-is, no vhost needed), and
MariaDB on `127.0.0.1:3306`. `.env.development` is set to
`http://localhost/api` to match. Because Laragon's docroot is a single
shared setting, repointing it to another project will stop BugHunt being
served until it's pointed back here.

Copy `.config.example.json` to `.config.json` (gitignored) in the project
root and fill in the real db credentials (this machine's Laragon MariaDB
uses a dedicated `developer` user, not `root`) - never commit that file.

Unlike a PHP built-in server, Apache enforces `.htaccess`, so
`/.config.json` correctly 403s and the deny rules in section 10 are live
here, not just in production.

Because the API's origin differs from the Vite dev server's origin,
`api/cors.php` also sends `Cross-Origin-Resource-Policy: cross-origin` for
localhost origins, so the frontend's `Cross-Origin-Embedder-Policy:
require-corp` (needed for `SharedArrayBuffer`, used for interactive
`input()` and interrupting runaway code) doesn't block API responses.

## Project layout

```
src/            React app (components, pages, python runtime glue, store)
api/            PHP backend (public + /admin endpoints, /sql schema+seed)
public/pyodide/ Generated at install time, gitignored
scripts/        Build-time helper scripts (e.g. copy-pyodide.mjs)
```

Puzzles, hints, tests and lesson content are validation-only on the client:
the reference solution is never sent until a puzzle is solved or given up
on. A hidden test's inputs reach the browser same as a visible one, but its
expected answer does not - grading it is a small server round trip
(`api/grade_hidden_test.php`) that sends only what running the student's
code produced and gets back pass/fail, never the answer. There are no
student accounts; progress lives in `localStorage` only, with a signature
that resets it if the saved file is hand-edited outside the app.

## Licence

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0). See `LICENSE.md`.
