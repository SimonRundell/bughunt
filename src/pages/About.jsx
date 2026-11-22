/**
 * About page (BUILD.md 9.1/11): how BugHunt works, privacy, and licence,
 * in plain language. Not auto-linked into the primary nav (matching the
 * footer-only pattern already used for Admin) - reachable from the site
 * footer.
 */
export default function About() {
  return (
    <div className="about">
      <h1>About BugHunt</h1>

      <section className="about__section">
        <h2>How it works</h2>
        <p>
          BugHunt is a debugging game. Every puzzle is real Python code with a real bug in it - find it, fix it, and
          prove the fix works by passing a set of tests. Python runs entirely in your browser (via Pyodide, a full
          CPython build compiled to WebAssembly), in a background worker with no access to the page itself. The
          server never sees or runs your code.
        </p>
        <p>
          Each puzzle walks the same six-step Debugging Loop: Reproduce, Read, Locate, Hypothesise, Fix, Verify - the
          same process professional developers use. Hints, a line tracer, and a concept glossary are there if you get
          stuck, but nothing is ever permanently locked behind them.
        </p>
      </section>

      <section className="about__section">
        <h2>Privacy</h2>
        <p>
          There are no accounts, no analytics, no cookies, no third-party scripts, and no fonts loaded from external
          hosts. Your progress (XP, badges, which puzzles you've solved) is stored only in this browser's{' '}
          <code>localStorage</code> - it is never sent to or stored on any server. Clearing your browser data erases
          it; the Progress page's Export button lets you save a copy as a file first if you want one.
        </p>
        <p>Your code is never sent anywhere either - every run happens locally, in your browser, in the worker described above.</p>
      </section>

      <section className="about__section">
        <h2>Licence</h2>
        <p>
          BugHunt's code, puzzles and lesson content are released under{' '}
          <strong>Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)</strong>.
          In plain terms: you may share and adapt this work with credit, for non-commercial use only, and any
          adaptation must carry the same licence. Full terms:{' '}
          <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">
            creativecommons.org/licenses/by-nc-sa/4.0
          </a>
          .
        </p>
        <p>
          BugHunt is built on open-source software (React, Vite, Monaco Editor, Pyodide and others) under their own
          licences - see <code>THIRD_PARTY.md</code> in the project source for the full list.
        </p>
      </section>
    </div>
  )
}
