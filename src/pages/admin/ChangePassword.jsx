import { useState } from 'react'
import { adminChangePassword } from '../../api/admin'

/**
 * Self-service password change, available to every logged-in account
 * (teacher or admin) for its own password - distinct from Accounts.jsx,
 * which only an admin can use and only to manage *other* accounts.
 */
export default function AdminChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    try {
      await adminChangePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.error?.message ?? 'Could not change password.')
    }
  }

  return (
    <div>
      <h1>Change password</h1>
      <form className="admin-form" onSubmit={handleSubmit}>
        <label>
          Current password
          <input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </label>
        <label>
          New password (min 8 characters)
          <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
        </label>
        <label>
          Confirm new password
          <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
        </label>
        {error && <p role="alert">{error}</p>}
        {success && <p role="status">Password changed.</p>}
        <button type="submit" className="btn btn--primary">Change password</button>
      </form>
    </div>
  )
}
