import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Debug from './pages/Debug'
import Track from './pages/Track'
import Puzzle from './pages/Puzzle'
import Progress from './pages/Progress'
import Playground from './pages/Playground'
import Concepts from './pages/Concepts'
import ConceptDetail from './pages/ConceptDetail'
import About from './pages/About'
import ErrorsDebug from './pages/dev/ErrorsDebug'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import CMFloatAd from './cmFloatAd'
import AdminLogin from './pages/admin/Login'
import AdminLayout from './pages/admin/AdminLayout'
import AdminPuzzleList from './pages/admin/PuzzleList'
import AdminPuzzleEditor from './pages/admin/PuzzleEditor'
import AdminTrackList from './pages/admin/TrackList'
import AdminConceptList from './pages/admin/ConceptList'
import AdminAccounts from './pages/admin/Accounts'
import AdminChangePassword from './pages/admin/ChangePassword'
import { loadSettings, SETTINGS_CHANGED_EVENT } from './store/settings'

/**
 * Root component. Full route set (Home, Track, Puzzle, Concepts, Progress,
 * About, Admin) per BUILD.md 9.1. SiteHeader/SiteFooter are mounted once
 * here (not per-page) so they persist across navigation - except on
 * /admin/*, which has its own nav and isn't part of the student-facing
 * app.
 */
function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

  // Settings' "always reduce motion" override, applied globally (not
  // just while SiteHeader is mounted) via a root attribute - see the
  // matching CSS rule next to the existing prefers-reduced-motion query.
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.reduceMotion = String(loadSettings().reduceMotion)
    }
    apply()
    window.addEventListener(SETTINGS_CHANGED_EVENT, apply)
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, apply)
  }, [])

  return (
    <>
      {!isAdmin && <SiteHeader />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/debug" element={<Debug />} />
        <Route path="/track/:slug" element={<Track />} />
        <Route path="/puzzle/:slug" element={<Puzzle />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/concepts" element={<Concepts />} />
        <Route path="/concepts/:slug" element={<ConceptDetail />} />
        <Route path="/about" element={<About />} />
        {import.meta.env.DEV && <Route path="/dev/errors" element={<ErrorsDebug />} />}

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="puzzles" replace />} />
          <Route path="puzzles" element={<AdminPuzzleList />} />
          <Route path="puzzles/new" element={<AdminPuzzleEditor />} />
          <Route path="puzzles/:id" element={<AdminPuzzleEditor />} />
          <Route path="tracks" element={<AdminTrackList />} />
          <Route path="concepts" element={<AdminConceptList />} />
          <Route path="accounts" element={<AdminAccounts />} />
          <Route path="password" element={<AdminChangePassword />} />
        </Route>
      </Routes>
      {!isAdmin && <SiteFooter />}
      {!isAdmin && <CMFloatAd bgColor="#05080c" color="white" />}
    </>
  )
}

export default App
