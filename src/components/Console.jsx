import { useEffect, useRef, useState } from 'react'

/**
 * Renders accumulated stdout/stderr, and - when interactive input is
 * supported - an inline prompt the student types into while a run is
 * blocked on input(), like a real terminal.
 *
 * @param {object} props
 * @param {{type: 'stdout'|'stderr', text: string}[]} props.lines
 * @param {boolean} props.awaitingInput
 * @param {(text: string) => void} props.onSubmitInput
 */
export default function Console({ lines, awaitingInput, onSubmitInput }) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [lines, awaitingInput])

  function submit() {
    onSubmitInput(draft)
    setDraft('')
  }

  return (
    <div className="console" role="log" aria-live="polite">
      <pre className="console__output">
        {lines.map((line, i) => (
          <span key={i} className={line.type === 'stderr' ? 'console__stderr' : undefined}>
            {line.text}
          </span>
        ))}
      </pre>
      {awaitingInput && (
        <div className="console__input-row">
          <span aria-hidden="true">{'>'}</span>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            aria-label="Input for the running program"
          />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
