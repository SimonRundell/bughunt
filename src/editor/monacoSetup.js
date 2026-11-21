/**
 * Local, self-hosted Monaco setup (no CDN at runtime). Imports only the
 * editor core and the Python language contribution, per BUILD.md 4.4.
 * (monaco-editor 0.57 moved Python's Monarch grammar from
 * esm/vs/basic-languages to esm/vs/languages/definitions.)
 * Theming beyond Monaco's built-in vs/vs-dark is added in Phase 5 with the
 * Settings panel.
 */
import * as monaco from 'monaco-editor/editor/editor.api'
import 'monaco-editor/languages/definitions/python/register'
import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'

let configured = false

/**
 * Wires Monaco's web worker and points @monaco-editor/react at the locally
 * bundled `monaco` instead of fetching it from a CDN. Call once at startup.
 */
export function setupMonaco() {
  if (configured) {
    return
  }
  configured = true

  self.MonacoEnvironment = {
    getWorker() {
      return new EditorWorker()
    },
  }

  loader.config({ monaco })
}
