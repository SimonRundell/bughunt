import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../../api/admin'

/**
 * Admin login (BUILD.md 8). Not linked from public navigation - reached
 * via the footer "Admin" link (BUILD.md 8) or a direct /admin visit.
 */
export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username, password)
      navigate('/admin/puzzles', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not log in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-login">
      <h1>BugHunt Admin</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="admin-username">Username</label>
        <input id="admin-username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />

        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p role="alert" className="admin-login__error">{error}</p>}

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}
