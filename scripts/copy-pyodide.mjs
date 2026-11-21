// postinstall: copies the Pyodide runtime data files Pyodide fetches at
// load time (via indexURL) into public/pyodide, so the app is fully
// self-hosted with no CDN dependency at runtime.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)))
const srcDir = join(rootDir, 'node_modules', 'pyodide')
const destDir = join(rootDir, 'public', 'pyodide')

// pyodide.asm.mjs is fetched from indexURL via a runtime `import()` inside
// pyodide.mjs itself (not resolved through Vite's module graph), so it has
// to be a real file alongside the wasm/lock/stdlib data, not just bundled.
const files = ['pyodide-lock.json', 'pyodide.asm.wasm', 'pyodide.asm.mjs', 'python_stdlib.zip']

mkdirSync(destDir, { recursive: true })

for (const file of files) {
  const src = join(srcDir, file)
  if (!existsSync(src)) {
    throw new Error(`copy-pyodide: expected file not found: ${src}`)
  }
  copyFileSync(src, join(destDir, file))
}

console.log(`copy-pyodide: copied ${files.length} files to public/pyodide`)
