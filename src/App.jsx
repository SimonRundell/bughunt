import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Track from './pages/Track'
import Puzzle from './pages/Puzzle'
import Progress from './pages/Progress'
import Playground from './pages/Playground'
import ErrorsDebug from './pages/dev/ErrorsDebug'
import CMFloatAd from './cmFloatAd'

/**
 * Root component. Full route set (Home, Track, Puzzle, Concepts, Progress,
 * About, admin) lands phase by phase per BUILD.md 9.1; Concepts, About and
 * admin are later phases and not wired yet.
 */
function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/track/:slug" element={<Track />} />
        <Route path="/puzzle/:slug" element={<Puzzle />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/playground" element={<Playground />} />
        {import.meta.env.DEV && <Route path="/dev/errors" element={<ErrorsDebug />} />}
      </Routes>
      <CMFloatAd />
    </>
  )
}

export default App
