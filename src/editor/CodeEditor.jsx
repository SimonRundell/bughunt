import { Editor } from '@monaco-editor/react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { setupMonaco } from './monacoSetup'

setupMonaco()

/**
 * Monaco editor configured for Python. Exposes `setMarkers(markers)`,
 * `revealLine(line)`, `getCursorLine()` and `highlightLine(line)` on its
 * ref, used by the Error Explainer, Diagnose and the Tracer to interact
 * with the editor without the parent re-rendering it.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {number} [props.fontSize]
 * @param {'vs'|'vs-dark'} [props.theme] - defaults to the app's dark-only look
 */
const CodeEditor = forwardRef(function CodeEditor(
  { value, onChange, fontSize = 15, theme = 'vs-dark' },
  ref,
) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)
  const containerRef = useRef(null)
  const retryIntervalRef = useRef(null)
  const traceDecorationIds = useRef([])

  useImperativeHandle(ref, () => ({
    setMarkers(markers) {
      const editor = editorRef.current
      const monaco = monacoRef.current
      if (!editor || !monaco) return
      monaco.editor.setModelMarkers(editor.getModel(), 'bughunt', markers)
    },
    revealLine(line) {
      editorRef.current?.revealLineInCenter(line)
    },
    /** @returns {number} the line number the cursor is currently on (1-based), or 1 if the editor isn't ready yet */
    getCursorLine() {
      return editorRef.current?.getPosition()?.lineNumber ?? 1
    },
    /** @param {number|null} line - the Tracer's "current step" indicator; pass null to clear it */
    highlightLine(line) {
      const editor = editorRef.current
      const monaco = monacoRef.current
      if (!editor || !monaco) return
      traceDecorationIds.current = editor.deltaDecorations(
        traceDecorationIds.current,
        line == null
          ? []
          : [
              {
                range: new monaco.Range(line, 1, line, 1),
                options: { isWholeLine: true, className: 'bughunt-trace-line', linesDecorationsClassName: 'bughunt-trace-line-margin' },
              },
            ],
      )
    },
  }))

  useEffect(() => {
    // Ongoing resizes after mount (e.g. a window resize) - automaticLayout
    // already covers most of these, this is a defensive backstop.
    const node = containerRef.current
    if (!node) return
    const observer = new ResizeObserver(() => {
      editorRef.current?.layout()
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      // If the component unmounts mid-retry (see onMount below), calling
      // .layout() on a disposed editor throws ("TextModel got disposed
      // before DiffEditorWidget model got reset" is the diff-editor
      // flavour of the same thing) - stop the retry loop on unmount too.
      clearInterval(retryIntervalRef.current)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
      <Editor
        language="python"
        theme={theme}
        value={value}
        onChange={(next) => onChange(next ?? '')}
        onMount={(editor, monaco) => {
          editorRef.current = editor
          monacoRef.current = monaco
          // Monaco sometimes finishes construction before its own internal
          // view is actually ready to accept a layout() call - a single
          // call right after onMount (even via requestAnimationFrame) can
          // still land too early and get silently ignored, leaving the
          // editor stuck rendering a single-digit-pixel sliver forever
          // (confirmed: calling .layout() again, even seconds later,
          // always fixes it - automaticLayout doesn't help because
          // nothing about the container itself changes size afterwards).
          // Retry a few times over ~1s rather than guess one exact delay.
          let attempts = 0
          retryIntervalRef.current = setInterval(() => {
            attempts += 1
            editor.layout()
            if (editor.getLayoutInfo().height > 50 || attempts >= 10) {
              clearInterval(retryIntervalRef.current)
            }
          }, 100)
        }}
        options={{
          fontFamily: "'Courier New', monospace",
          fontSize,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />
    </div>
  )
})

export default CodeEditor
