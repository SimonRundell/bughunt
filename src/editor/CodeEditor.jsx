import { Editor } from '@monaco-editor/react'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { setupMonaco } from './monacoSetup'

setupMonaco()

/**
 * Monaco editor configured for Python. Exposes `setMarkers(markers)` and
 * `revealLine(line)` on its ref, used by the Error Explainer and (from
 * Phase 4) the tracer to highlight lines without the parent re-rendering
 * the editor.
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {number} [props.fontSize]
 * @param {'vs'|'vs-dark'} [props.theme]
 */
const CodeEditor = forwardRef(function CodeEditor(
  { value, onChange, fontSize = 15, theme = 'vs' },
  ref,
) {
  const editorRef = useRef(null)
  const monacoRef = useRef(null)

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
  }))

  return (
    <Editor
      language="python"
      theme={theme}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      onMount={(editor, monaco) => {
        editorRef.current = editor
        monacoRef.current = monaco
      }}
      options={{
        fontFamily: "'Courier New', monospace",
        fontSize,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
      }}
    />
  )
})

export default CodeEditor
