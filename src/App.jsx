import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Debug from './pages/Debug'
import Track from './pages/Track'
import Puzzle from './pages/Puzzle'
import Progress from './pages/Progress'
import Playground from './pages/Playground'
import ErrorsDebug from './pages/dev/ErrorsDebug'
import SiteHeader from './components/SiteHeader'
import CMFloatAd from './cmFloatAd'
import AdminLogin from './pages/admin/Login'
import AdminLayout from './pages/admin/AdminLayout'
import AdminPuzzleList from './pages/admin/PuzzleList'
import AdminPuzzleEditor from './pages/admin/PuzzleEditor'
import AdminTrackList from './pages/admin/TrackList'
import AdminConceptList from './pages/admin/ConceptList'
import AdminAccounts from './pages/admin/Accounts'
import AdminChangePassword from './pages/admin/ChangePassword'

/**
 * Root component. Full route set (Home, Track, Puzzle, Concepts, Progress,
 * About, admin) lands phase by phase per BUILD.md 9.1; Concepts and About
 * are later phases and not wired yet. SiteHeader is mounted once here
 * (not per-page) so it persists across navigation - except on /admin/*,
 * which has its own nav and isn't part of the student-facing app.
 */
function App() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/admin')

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
      {!isAdmin && <CMFloatAd bgColor="#05080c" color="white" />}
    </>
  )
}

export default App
