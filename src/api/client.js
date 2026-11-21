import axios from 'axios'

/**
 * Shared Axios instance. Base URL comes from VITE_API_BASE_URL in dev
 * (section 5.1), falling back to same-origin /api in production.
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',
})

export default client
