import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { adminCreateAccount, adminDeleteAccount, adminListAccounts } from '../../api/admin'

/**
 * Teacher/admin account management (admin role only - BUILD.md's spec
 * didn't have roles; this is the addition for that). An admin is also a
 * teacher, so this is purely account management, not a permissions page.
 */
export default function AdminAccounts() {
  const { session } = useOutletContext()
  const [accounts, setAccounts] = useState(null)
  const [form, setForm] = useState({ username: '', password: '', role: 'teacher' })
  const [error, setError] = useState(null)
  const [confirmId, setConfirmId] = useState(null)

  function reload() {
    adminListAccounts().then(setAccounts)
  }

  useEffect(() => {
    reload()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    try {
      await adminCreateAccount(form)
      setForm({ username: '', password: '', role: 'teacher' })
      reload()
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not create account.')
    }
  }

  async function handleDelete(id) {
    if (confirmId !== id) {
      setConfirmId(id)
      return
    }
    try {
      await adminDeleteAccount(id)
      setConfirmId(null)
      reload()
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not delete account.')
    }
  }

  return (
    <div>
      <h1>Accounts</h1>
      <p>Teachers can author, verify and publish puzzles, tracks and concepts, same as an admin - they just can't manage accounts.</p>

      <form className="admin-form" onSubmit={handleCreate}>
        <label>
          Username
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
        </label>
        <label>
          Password (min 8 characters)
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} required />
        </label>
        <label>
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="btn btn--primary">Create account</button>
      </form>

      {!accounts ? (
        <p>Loading…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.username}</td>
                <td>{a.role}</td>
                <td>{a.last_login_at ?? 'never'}</td>
                <td>
                  {a.username !== session.username && (
                    <button type="button" className="btn btn--small btn--danger" onClick={() => handleDelete(a.id)}>
                      {confirmId === a.id ? 'Confirm delete' : 'Delete'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
