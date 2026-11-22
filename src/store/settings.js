/**
 * Student settings (BUILD.md 9.4): editor font size/family, reduced
 * motion, line numbers. Stored separately from progress since resetting
 * progress shouldn't also reset display preferences. Same try/catch
 * discipline as progress.js - storage can be blocked or full.
 *
 * No `theme` field: BugHunt is dark-only by design (Tron doesn't have a
 * sensible light variant - see PROGRESS.md's Phase 2 design pass), so
 * there's no theme switcher to store a value for.
 */

export const STORAGE_KEY = 'bughunt.settings.v1'
export const CURRENT_VERSION = 1
/** Dispatched on `window` after every successful save, so already-mounted
 * components (editors, the reduce-motion root attribute) can react
 * without a dedicated store/context - mirrors progress.js's PROGRESS_CHANGED_EVENT. */
export const SETTINGS_CHANGED_EVENT = 'bughunt-settings-changed'

/** @returns {object} default settings */
export function createDefaultSettings() {
  return {
    version: CURRENT_VERSION,
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
    window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT))
    return true
  } catch {
    return false
  }
}

/** @param {string} editorFontFamily @returns {string} the actual CSS font-family stack for an editor */
export function fontFamilyStack(editorFontFamily) {
  return editorFontFamily === 'OpenDyslexic' ? "'OpenDyslexic', 'Courier New', monospace" : "'Courier New', monospace"
}
