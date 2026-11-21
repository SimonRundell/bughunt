# BugHunt

A browser-based Python debugging game for post-16 students. Python runs
client-side in a Web Worker via Pyodide; a PHP/MySQL backend serves and
stores puzzles. See `BUILD.md` for the full brief, decisions and build
order.

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
on, but hidden tests do reach the browser. There are no student accounts;
progress lives in `localStorage` only.

## Licence

Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
(CC BY-NC-SA 4.0). See `LICENSE.md`.
