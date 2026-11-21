/**
 * Student settings (BUILD.md 9.4): theme, editor font size/family, reduced
 * motion, line numbers. Stored separately from progress since resetting
 * progress shouldn't also reset display preferences. Same try/catch
 * discipline as progress.js - storage can be blocked or full.
 */

export const STORAGE_KEY = 'bughunt.settings.v1'
export const CURRENT_VERSION = 1

/** @returns {object} default settings */
export function createDefaultSettings() {
  return {
    version: CURRENT_VERSION,
    theme: 'light', // 'light' | 'dark' | 'high-contrast'
    editorFontSize: 16,
    editorFontFamily: 'Courier New', // 'Courier New' | 'OpenDyslexic'
    reduceMotion: false,
    showLineNumbers: true,
  }
}

/** @returns {object} stored settings, or defaults if missing/corrupt */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDefaultSettings()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || typeof parsed.version !== 'number') {
      return createDefaultSettings()
    }
    return { ...createDefaultSettings(), ...parsed }
  } catch {
    return createDefaultSettings()
  }
}

/** @param {object} settings @returns {boolean} whether the save succeeded */
export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}
