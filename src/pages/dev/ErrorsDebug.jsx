import ErrorExplainer from '../../components/ErrorExplainer'
import { errorFixtures } from '../../python/errorFixtures'

/**
 * Dev-only smoke test for errorDecoder.js (BUILD.md 4.7). Renders every
 * fixture so a pattern miss or a bad message is visible at a glance.
 * Only mounted when import.meta.env.DEV (see App.jsx).
 */
export default function ErrorsDebug() {
  return (
    <div className="errors-debug">
      <h1>Error decoder fixtures</h1>
      {errorFixtures.map(({ label, error }) => (
        <section key={label}>
          <h2>{label}</h2>
          <ErrorExplainer error={error} />
        </section>
      ))}
    </div>
  )
}
