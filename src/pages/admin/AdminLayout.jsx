import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { logout, me } from '../../api/admin'

/**
 * Guards every /admin/* route (except login) behind a session check
 * (BUILD.md 8). Renders the admin nav + whichever sub-page is active.
 */
export default function AdminLayout() {
  const [session, setSession] = useState(undefined) // undefined = checking, null = not logged in

  useEffect(() => {
    me().then(setSession)
  }, [])

  if (session === undefined) {
    return <p className="admin-layout">Checking session…</p>
  }
  if (session === null) {
    return <Navigate to="/admin/login" replace />
  }

  async function handleLogout() {
    await logout()
    setSession(null)
  }

  return (
    <div className="admin-layout">
      <nav className="admin-layout__nav">
        <NavLink to="/admin/puzzles" className={({ isActive }) => (isActive ? 'active' : '')}>
          Puzzles
        </NavLink>
        <NavLink to="/admin/tracks" className={({ isActive }) => (isActive ? 'active' : '')}>
          Tracks
        </NavLink>
        <NavLink to="/admin/concepts" className={({ isActive }) => (isActive ? 'active' : '')}>
          Concepts
        </NavLink>
        {session.role === 'admin' && (
          <NavLink to="/admin/accounts" className={({ isActive }) => (isActive ? 'active' : '')}>
            Accounts
          </NavLink>
        )}
        <NavLink to="/admin/password" className={({ isActive }) => (isActive ? 'active' : '')}>
          Password
        </NavLink>
        <span className="admin-layout__who">
          {session.username} ({session.role})
        </span>
        <button type="button" className="btn btn--small" onClick={handleLogout}>
          Log out
        </button>
      </nav>
      <div className="admin-layout__content">
        <Outlet context={{ session }} />
      </div>
    </div>
  )
}
