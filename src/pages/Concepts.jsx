import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getConcepts } from '../api/puzzles'

/**
 * Concept card list (BUILD.md 3.3/9.1): every concept a puzzle can link
 * to, browsable on its own as a short reference, not just reachable via a
 * puzzle.
 */
export default function Concepts() {
  const [concepts, setConcepts] = useState(null)

  useEffect(() => {
    getConcepts().then(setConcepts)
  }, [])

  if (!concepts) return <p className="concepts">Loading concepts…</p>

  return (
    <div className="concepts">
      <h1>Concepts</h1>
      <p>Short lessons behind the bugs - what each one is, how to spot it, and how to fix it.</p>
      <ul className="concepts__list">
        {concepts.map((concept) => (
          <li key={concept.slug} className="concepts__item">
            <Link to={`/concepts/${concept.slug}`}>
              <h2>{concept.title}</h2>
              <p>{concept.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
