# Third-party software

BugHunt's own code, puzzles and lesson content are released under
CC BY-NC-SA 4.0 (see `LICENSE.md`). The open-source software it's built
on keeps its own licence, listed here per that software's terms.

## Runtime dependencies (shipped to the browser)

| Package | Licence | Used for |
|---|---|---|
| [React](https://react.dev) / [react-dom](https://react.dev) | MIT | UI framework |
| [react-router-dom](https://reactrouter.com) | MIT | Client-side routing |
| [Axios](https://axios-http.com) | MIT | HTTP calls to the PHP API |
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) / [@monaco-editor/react](https://github.com/suren-atoyan/monaco-react) | MIT | The code editor (same engine as VS Code) |
| [Pyodide](https://pyodide.org) | MPL-2.0 | CPython compiled to WebAssembly, runs student code in a browser worker |
| [react-markdown](https://github.com/remarkjs/react-markdown) | MIT | Rendering puzzle briefs, hints and lesson content |
| [@fontsource/opendyslexic](https://fontsource.org/fonts/opendyslexic) (bundling the [OpenDyslexic](https://opendyslexic.org) typeface) | OFL-1.1 | The dyslexia-friendly font option in Settings, self-hosted |

**Pyodide note:** BugHunt only loads Pyodide's core runtime and the Python
standard library (`ast`, `io`, `json`, `math`, `sys`, `time`, `traceback`,
plus the small set of stdlib modules allowed in student code - see
`.config.json`'s `allowedImports`). CPython itself is covered by the
[Python Software Foundation License](https://docs.python.org/3/license.html).
None of Pyodide's optional scientific-package builds (NumPy, pandas, and
so on) are loaded, so their separate licences don't apply here.

## Build tooling (not shipped, used to build and develop the app)

| Package | Licence | Used for |
|---|---|---|
| [Vite](https://vitejs.dev) | MIT | Dev server and production bundler |
| [Vitest](https://vitest.dev) | MIT | Test runner |
| [Testing Library](https://testing-library.com) | MIT | Component tests |
| [oxlint](https://oxc.rs) | MIT | Linting |

## Backend

The PHP API (`/api`) has no third-party dependencies - it's plain PHP
against a MySQL/MariaDB database, no Composer packages.
