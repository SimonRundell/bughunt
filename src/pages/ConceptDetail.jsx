import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { getConcept } from '../api/puzzles'
import SnippetRunner from '../components/SnippetRunner'

/**
 * Splits a concept's lesson_md into the written lesson and its trailing
 * "Try it" runnable snippet (authored as a ```python run fenced block -
 * see scripts/seed/concepts.mjs), so the snippet renders as a live editor
 * instead of a second static copy of the same code.
 *
 * @param {string} lessonMd
 * @returns {{ body: string, tryItCode: string | null }}
 */
function splitLessonMd(lessonMd) {
  const match = lessonMd.match(/##\s*Try it\s*\n+```python run\n([\s\S]*?)```\s*$/)
  if (!match) return { body: lessonMd, tryItCode: null }
  return { body: lessonMd.slice(0, match.index).trimEnd(), tryItCode: match[1].replace(/\n$/, '') }
}

/**
 * One concept card (BUILD.md 3.3): the five-part lesson shape (what it
 * is / what it looks like when it goes wrong / how to spot it / how to
 * fix it / try it) plus a live runnable snippet for the last part.
 */
export default function ConceptDetail() {
  const { slug } = useParams()
  const [concept, setConcept] = useState(null)

  useEffect(() => {
    setConcept(null)
    getConcept(slug).then(setConcept)
  }, [slug])

  if (!concept) return <p className="concept-detail">Loading concept…</p>

  const { body, tryItCode } = splitLessonMd(concept.lesson_md)

  return (
    <div className="concept-detail">
      <Link to="/concepts" className="btn btn--small back-link">&larr; Concepts</Link>
      <h1>{concept.title}</h1>
      <div className="concept-detail__lesson">
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>

      {tryItCode && (
        <section>
          <h2>Try it</h2>
          <SnippetRunner initialCode={tryItCode} />
        </section>
      )}
    </div>
  )
}
