import { Link } from 'react-router-dom'

/**
 * Landing page: explains what BugHunt is and how it works. The track map
 * itself lives at /debug now (see Debug.jsx) - top-level nav for Debug,
 * Playground, Progress and Admin lives in SiteHeader, not here.
 */
export default function Home() {
  return (
    <div className="about">
      <h1>BugHunt</h1>
      <p className="about__lede">
        BugHunt is a debugging game. Every puzzle is real Python code with a real bug in it - your job is to find it, fix
        it, and prove the fix works. Everything runs in your browser; nothing you write is sent anywhere until you choose
        to save it.
      </p>

      <section className="about__section">
        <h2>Five tracks, each with a different kind of bug</h2>
        <ul className="about__tracks">
          <li><strong>Spot the Typo</strong> - the code won't even run yet.</li>
          <li><strong>Crash Course</strong> - it runs, then crashes partway through.</li>
          <li><strong>Wrong Answer</strong> - it runs fine and gives you a confidently wrong result.</li>
          <li><strong>Deep Bugs</strong> - subtler logic bugs hiding in state, scope or recursion.</li>
          <li><strong>Boss Fights</strong> - bigger programs with more than one bug at once.</li>
        </ul>
      </section>

      <section className="about__section">
        <h2>The debugging loop</h2>
        <p>Every puzzle uses the same six-step process real developers use:</p>
        <ol className="about__loop">
          <li><strong>Reproduce</strong> - run it. What actually happens?</li>
          <li><strong>Read</strong> - read the error or the wrong output. Start at the bottom of a traceback.</li>
          <li><strong>Locate</strong> - narrow it down. Which line or block is suspect?</li>
          <li><strong>Hypothesise</strong> - say what you think is wrong, in one sentence.</li>
          <li><strong>Fix</strong> - change one thing.</li>
          <li><strong>Verify</strong> - run all the tests. Think about edge cases.</li>
        </ol>
      </section>

      <section className="about__section">
        <h2>Hints, XP and badges</h2>
        <p>
          Stuck? Three tiers of hints are there if you want them, each costing a little XP so a clean solve is always
          worth more. Fixing puzzles earns XP, which ranks you up and unlocks badges - all tracked locally in your
          browser, exportable any time from the Progress page.
        </p>
      </section>

      <Link to="/debug" className="btn btn--primary about__cta">
        Start debugging
      </Link>
    </div>
  )
}
