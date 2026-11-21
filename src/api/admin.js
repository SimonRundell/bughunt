import client from './client'

/**
 * Admin API calls (BUILD.md 5.3) plus the bearer-token session handling:
 * the raw token lives only in sessionStorage (not localStorage - it
 * shouldn't outlive the browser tab, and never touches the student
 * progress store), and every admin request attaches it automatically via
 * an Axios interceptor.
 */
const TOKEN_KEY = 'bughunt.admin.token'

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // sessionStorage unavailable - session just won't persist a reload.
  }
}

client.interceptors.request.use((config) => {
  const token = getToken()
  if (token && config.url?.includes('/admin/')) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** @param {string} username @param {string} password @returns {Promise<{token: string, username: string, role: string}>} */
export async function login(username, password) {
  const res = await client.post('/admin/login.php', { username, password })
  setToken(res.data.data.token)
  return res.data.data
}

export async function logout() {
  try {
    await client.post('/admin/logout.php')
  } finally {
    setToken(null)
  }
}

/** @returns {Promise<{username: string, role: string}|null>} null if not logged in / session expired */
export async function me() {
  if (!getToken()) return null
  try {
    const res = await client.get('/admin/me.php')
    return res.data.data
  } catch {
    setToken(null)
    return null
  }
}

// --- Puzzles ---
export async function adminListPuzzles() {
  return (await client.get('/admin/puzzles.php')).data.data
}
export async function adminCreatePuzzle(payload) {
  return (await client.post('/admin/puzzles.php', payload)).data.data
}
export async function adminGetPuzzle(id) {
  return (await client.get('/admin/puzzle.php', { params: { id } })).data.data
}
export async function adminSavePuzzle(id, payload) {
  return (await client.put(`/admin/puzzle.php?id=${id}`, payload)).data.data
}
export async function adminDeletePuzzle(id) {
  return (await client.delete(`/admin/puzzle.php?id=${id}`)).data.data
}
export async function adminVerifyPuzzle(id) {
  return (await client.post('/admin/verify.php', { id })).data.data
}

// --- Tracks ---
export async function adminListTracks() {
  return (await client.get('/admin/tracks.php')).data.data
}
export async function adminCreateTrack(payload) {
  return (await client.post('/admin/tracks.php', payload)).data.data
}
export async function adminSaveTrack(id, payload) {
  return (await client.put(`/admin/tracks.php?id=${id}`, payload)).data.data
}
export async function adminDeleteTrack(id) {
  return (await client.delete(`/admin/tracks.php?id=${id}`)).data.data
}

// --- Concepts ---
export async function adminListConcepts() {
  return (await client.get('/admin/concepts.php')).data.data
}
export async function adminCreateConcept(payload) {
  return (await client.post('/admin/concepts.php', payload)).data.data
}
export async function adminSaveConcept(id, payload) {
  return (await client.put(`/admin/concepts.php?id=${id}`, payload)).data.data
}
export async function adminDeleteConcept(id) {
  return (await client.delete(`/admin/concepts.php?id=${id}`)).data.data
}

// --- Accounts (admin role only) ---
export async function adminListAccounts() {
  return (await client.get('/admin/accounts.php')).data.data
}
export async function adminCreateAccount(payload) {
  return (await client.post('/admin/accounts.php', payload)).data.data
}
export async function adminDeleteAccount(id) {
  return (await client.delete(`/admin/accounts.php?id=${id}`)).data.data
}

/** @param {string} currentPassword @param {string} newPassword Self-service - any logged-in account (teacher or admin) can change its own password. */
export async function adminChangePassword(currentPassword, newPassword) {
  return (await client.post('/admin/change_password.php', { current_password: currentPassword, new_password: newPassword })).data.data
}

// --- Import / export ---
/** @returns {Promise<string>} the raw bundle JSON text, for a client-side blob download (export.php needs the auth header, which a plain <a href> download can't carry) */
export async function adminExport() {
  const res = await client.get('/admin/export.php', { responseType: 'text' })
  return res.data
}
export async function adminImport(bundle) {
  return (await client.post('/admin/import.php', bundle)).data.data
}
