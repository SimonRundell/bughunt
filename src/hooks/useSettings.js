import { useEffect, useState } from 'react'
import { loadSettings, SETTINGS_CHANGED_EVENT } from '../store/settings'

/**
 * Reactive read of the settings store - re-reads whenever `saveSettings`
 * dispatches `SETTINGS_CHANGED_EVENT`, so every editor on the page (not
 * just the one that opened the Settings panel) picks up a font/line-
 * number change immediately.
 * @returns {ReturnType<typeof loadSettings>}
 */
export function useSettings() {
  const [settings, setSettings] = useState(() => loadSettings())

  useEffect(() => {
    const onChange = () => setSettings(loadSettings())
    window.addEventListener(SETTINGS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, onChange)
  }, [])

  return settings
}
