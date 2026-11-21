/**
 * The six-step Debugging Loop (BUILD.md 3.2), always visible on the puzzle
 * page. It's guidance, not a gate - steps tick automatically from student
 * actions tracked by the Puzzle page, and nothing here blocks progress.
 *
 * @param {object} props
 * @param {boolean[]} props.completed - six booleans, one per step, in order
 */
export default function DebugLoopStepper({ completed }) {
  return (
    <ol className="debug-loop">
      {STEPS.map((step, index) => (
        <li
          key={step.title}
          className={`debug-loop__step${completed[index] ? ' debug-loop__step--done' : ''}`}
          title={step.whatGoodLooksLike}
        >
          <span className="debug-loop__number" aria-hidden="true">
            {completed[index] ? '✓' : index + 1}
          </span>
          <span className="debug-loop__text">
            <strong>{step.title}</strong>
            <span className="debug-loop__prompt">{step.prompt}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

const STEPS = [
  {
    title: 'Reproduce',
    prompt: 'Run it. What actually happens?',
    whatGoodLooksLike: 'What good looks like: you\'ve actually run the code at least once before changing anything.',
  },
  {
    title: 'Read',
    prompt: 'Read the error or the wrong output. Start at the bottom of a traceback.',
    whatGoodLooksLike: 'What good looks like: you\'ve read the Error Explainer or Tests tab, not just glanced at it.',
  },
  {
    title: 'Locate',
    prompt: 'Narrow it down. Which line or block is suspect?',
    whatGoodLooksLike: 'What good looks like: you can point at a specific line, not just "somewhere in here".',
  },
  {
    title: 'Hypothesise',
    prompt: 'Say what you think is wrong, in one sentence.',
    whatGoodLooksLike: 'What good looks like: a one-sentence guess you could say out loud to someone else.',
  },
  {
    title: 'Fix',
    prompt: 'Change one thing.',
    whatGoodLooksLike: 'What good looks like: one deliberate change, not a rewrite of the whole thing.',
  },
  {
    title: 'Verify',
    prompt: 'Run all tests. Think about edge cases.',
    whatGoodLooksLike: 'What good looks like: every test passes, including the ones you can\'t see.',
  },
]
