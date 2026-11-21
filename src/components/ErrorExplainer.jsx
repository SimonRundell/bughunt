import { decodeError } from '../python/errorDecoder'

/**
 * Plain-English breakdown of a Python error (BUILD.md 4.7). Concept cards
 * (and so a real link for `conceptSlug`) land in Phase 4 - shown as plain
 * text for now.
 *
 * @param {object} props
 * @param {{type: string, message: string, line: number|null, traceback: string}|null} props.error
 */
export default function ErrorExplainer({ error }) {
  if (!error) {
    return <p className="error-explainer__empty">Run some code to see errors explained here.</p>
  }

  const decoded = decodeError(error)

  return (
    <div className="error-explainer">
      <h3>{decoded.title}</h3>
      <p>{decoded.plain}</p>
      <p className="error-explainer__raw">
        {error.type}
        {error.message ? `: ${error.message}` : ''}
        {error.line ? ` (line ${error.line})` : ''}
      </p>
      <h4>Common causes</h4>
      <ul>
        {decoded.causes.map((cause, i) => (
          <li key={i}>{cause}</li>
        ))}
      </ul>
      <h4>Where to look</h4>
      <p>{decoded.whereToLook}</p>
      <p className="error-explainer__concept">Concept: {decoded.conceptSlug}</p>
    </div>
  )
}
