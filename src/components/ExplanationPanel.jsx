import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DiffEditor } from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import { setupMonaco } from '../editor/monacoSetup'
import { getConceptTitleMap } from '../api/puzzles'
import { useSettings } from '../hooks/useSettings'
import { fontFamilyStack } from '../store/settings'

setupMonaco()

/**
 * Post-solve (or post-give-up) explanation (BUILD.md 3.3, 9.3): what each
 * bug was with its lines highlighted in a read-only diff, why Python
 * behaved that way, a "spot it next time" habit, and the student's code
 * side by side with the fix. Links to the relevant concept cards, both
 * per-bug and for the puzzle as a whole.
 *
 * @param {object} props
 * @param {object} props.solution - from getSolution(slug): fixed_code, bugs, explanation_md, spot_it_md
 * @param {string} props.studentCode - the code they ran, for the diff's "original" side
 * @param {number} props.xpAwarded
 * @param {boolean} props.gaveUp
 * @param {string[]} [props.concepts]
 */
export default function ExplanationPanel({ solution, studentCode, xpAwarded, gaveUp, concepts = [] }) {
  const modifiedEditorRef = useRef(null)
  const [conceptTitles, setConceptTitles] = useState(new Map())
  const settings = useSettings()

  useEffect(() => {
    getConceptTitleMap().then(setConceptTitles)
  }, [])

  function handleDiffMount(editor, monaco) {
    modifiedEditorRef.current = editor.getModifiedEditor()
    const decorations = (solution.bugs ?? []).map((bug) => ({
      range: new monaco.Range(bug.line_start, 1, bug.line_end, 1),
      options: {
        isWholeLine: true,
        className: 'bughunt-bug-line',
        linesDecorationsClassName: 'bughunt-bug-line-margin',
      },
    }))
    modifiedEditorRef.current.deltaDecorations([], decorations)
  }

  return (
    <div className="explanation-panel">
      <h2>{gaveUp ? "Here's what was going on" : 'Solved!'}</h2>
      <p className="explanation-panel__xp">
        {gaveUp ? '0 XP - you can retry this puzzle later for XP.' : `+${xpAwarded} XP`}
      </p>

      <h3>What was wrong</h3>
      <ul className="explanation-panel__bugs">
        {(solution.bugs ?? []).map((bug, i) => (
          <li key={i}>
            <strong>{bug.line_start === bug.line_end ? `Line ${bug.line_start}` : `Lines ${bug.line_start}-${bug.line_end}`}:</strong>
            <ReactMarkdown>{bug.what_md}</ReactMarkdown>
            <p className="explanation-panel__fix-label">Fix:</p>
            <ReactMarkdown>{bug.fix_md}</ReactMarkdown>
            {bug.concept && (
              <p className="explanation-panel__bug-concept">
                Concept: <Link to={`/concepts/${bug.concept}`}>{conceptTitles.get(bug.concept) ?? bug.concept}</Link>
              </p>
            )}
          </li>
        ))}
      </ul>

      <h3>Why</h3>
      <div className="explanation-panel__markdown">
        <ReactMarkdown>{solution.explanation_md}</ReactMarkdown>
      </div>

      {solution.spot_it_md && (
        <>
          <h3>Spot it next time</h3>
          <div className="explanation-panel__markdown">
            <ReactMarkdown>{solution.spot_it_md}</ReactMarkdown>
          </div>
        </>
      )}

      <h3>Your code vs the fix</h3>
      <div className="explanation-panel__diff">
        <DiffEditor
          height="300px"
          language="python"
          theme="vs-dark"
          original={studentCode}
          modified={solution.fixed_code}
          onMount={handleDiffMount}
          options={{
            readOnly: true,
            renderSideBySide: true,
            fontFamily: fontFamilyStack(settings.editorFontFamily),
            fontSize: settings.editorFontSize,
            lineNumbers: settings.showLineNumbers ? 'on' : 'off',
            minimap: { enabled: false },
            automaticLayout: true,
          }}
        />
      </div>

      {concepts.length > 0 && (
        <p className="explanation-panel__concepts">
          Concepts:{' '}
          {concepts.map((slug, i) => (
            <span key={slug}>
              {i > 0 && ', '}
              <Link to={`/concepts/${slug}`}>{conceptTitles.get(slug) ?? slug}</Link>
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
