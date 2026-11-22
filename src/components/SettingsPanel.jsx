import { loadSettings, saveSettings } from '../store/settings'
import { useSettings } from '../hooks/useSettings'

/**
 * Display settings (BUILD.md 9.4/11): editor font size, an OpenDyslexic
 * font option, a reduce-motion override (on top of the OS-level
 * `prefers-reduced-motion` media query, for a student whose OS default
 * doesn't match what they want here), and a show/hide line numbers
 * toggle. No theme switcher - BugHunt is dark-only by design.
 *
 * @param {object} props
 * @param {() => void} props.onClose
 */
export default function SettingsPanel({ onClose }) {
  const settings = useSettings()

  function update(patch) {
    saveSettings({ ...loadSettings(), ...patch })
  }

  return (
    <div className="settings-panel" role="dialog" aria-label="Settings">
      <div className="settings-panel__head">
        <h2>Settings</h2>
        <button type="button" className="btn btn--small" onClick={onClose}>
          Close
        </button>
      </div>

      <label className="settings-panel__row">
        <span>Editor font size</span>
        <input
          type="number"
          min={12}
          max={28}
          value={settings.editorFontSize}
          onChange={(e) => update({ editorFontSize: Math.max(12, Math.min(28, Number(e.target.value) || 16)) })}
        />
      </label>

      <label className="settings-panel__row">
        <span>Editor font</span>
        <select value={settings.editorFontFamily} onChange={(e) => update({ editorFontFamily: e.target.value })}>
          <option value="Courier New">Courier New</option>
          <option value="OpenDyslexic">OpenDyslexic (dyslexia-friendly)</option>
        </select>
      </label>

      <label className="settings-panel__row settings-panel__row--checkbox">
        <input type="checkbox" checked={settings.showLineNumbers} onChange={(e) => update({ showLineNumbers: e.target.checked })} />
        <span>Show line numbers</span>
      </label>

      <label className="settings-panel__row settings-panel__row--checkbox">
        <input type="checkbox" checked={settings.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} />
        <span>Always reduce motion</span>
      </label>
      <p className="settings-panel__hint">
        Animations already respect your operating system's reduced-motion setting - turn this on to reduce them here
        regardless of that setting.
      </p>
    </div>
  )
}
