import { Link } from 'react-router-dom'

/**
 * Minimal site footer - just the About link (licence, privacy, how it
 * works). Everything else lives in SiteHeader's top nav; About wasn't
 * part of that explicit list, so it gets its own quiet footer spot
 * instead, matching BUILD.md 8's footer-link pattern for secondary pages.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link to="/about">About</Link>
    </footer>
  )
}
