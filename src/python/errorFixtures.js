/**
 * Sample errors for smoke-testing errorDecoder.js, rendered on /dev/errors
 * (dev build only). Messages are written to match current CPython wording
 * (3.10+ PEG-parser style, stable through the pinned 3.14.2) but have not
 * yet been run through the actual pinned Pyodide build to confirm exact
 * wording - see PROGRESS.md, "Known gaps", before trusting these as final.
 */

export const errorFixtures = [
  {
    label: 'Missing colon',
    error: { type: 'SyntaxError', message: "expected ':'", line: 1, traceback: '' },
  },
  {
    label: 'Unterminated string',
    error: { type: 'SyntaxError', message: 'unterminated string literal (detected at line 1)', line: 1, traceback: '' },
  },
  {
    label: 'Unclosed bracket',
    error: { type: 'SyntaxError', message: "'(' was never closed", line: 1, traceback: '' },
  },
  {
    label: 'Single equals in a condition',
    error: { type: 'SyntaxError', message: "cannot assign to comparison here. Maybe you meant '==' instead of '='?", line: 1, traceback: '' },
  },
  {
    label: 'Invalid decimal literal',
    error: { type: 'SyntaxError', message: 'invalid decimal literal', line: 1, traceback: '' },
  },
  {
    label: 'Generic invalid syntax',
    error: { type: 'SyntaxError', message: 'invalid syntax', line: 1, traceback: '' },
  },
  {
    label: 'Missing indented block',
    error: { type: 'IndentationError', message: 'expected an indented block after \'if\' statement on line 1', line: 2, traceback: '' },
  },
  {
    label: 'Unexpected indent',
    error: { type: 'IndentationError', message: 'unexpected indent', line: 2, traceback: '' },
  },
  {
    label: 'Unindent mismatch',
    error: { type: 'IndentationError', message: 'unindent does not match any outer indentation level', line: 3, traceback: '' },
  },
  {
    label: 'Misspelled variable',
    error: { type: 'NameError', message: "name 'totl' is not defined", line: 4, traceback: '' },
  },
  {
    label: 'Local variable before assignment',
    error: { type: 'UnboundLocalError', message: "cannot access local variable 'total' where it is not associated with a value", line: 3, traceback: '' },
  },
  {
    label: 'Text plus number',
    error: { type: 'TypeError', message: 'unsupported operand type(s) for +: \'int\' and \'str\'', line: 2, traceback: '' },
  },
  {
    label: 'Concatenate string and non-string',
    error: { type: 'TypeError', message: 'can only concatenate str (not "int") to str', line: 2, traceback: '' },
  },
  {
    label: 'Not callable',
    error: { type: 'TypeError', message: "'list' object is not callable", line: 5, traceback: '' },
  },
  {
    label: 'Wrong number of arguments',
    error: { type: 'TypeError', message: "sum_to() missing 1 required positional argument: 'n'", line: 1, traceback: '' },
  },
  {
    label: 'Not subscriptable',
    error: { type: 'TypeError', message: "'NoneType' object is not subscriptable", line: 6, traceback: '' },
  },
  {
    label: 'int() on bad text',
    error: { type: 'ValueError', message: "invalid literal for int() with base 10: '3.5'", line: 2, traceback: '' },
  },
  {
    label: 'Past the end of a list',
    error: { type: 'IndexError', message: 'list index out of range', line: 3, traceback: '' },
  },
  {
    label: 'Missing dictionary key',
    error: { type: 'KeyError', message: "'colour'", line: 2, traceback: '' },
  },
  {
    label: 'None has no attribute',
    error: { type: 'AttributeError', message: "'NoneType' object has no attribute 'append'", line: 4, traceback: '' },
  },
  {
    label: 'Attribute typo',
    error: { type: 'AttributeError', message: "'str' object has no attribute 'push'", line: 2, traceback: '' },
  },
  {
    label: 'Divide by zero',
    error: { type: 'ZeroDivisionError', message: 'division by zero', line: 3, traceback: '' },
  },
  {
    label: 'Recursion without a base case',
    error: { type: 'RecursionError', message: 'maximum recursion depth exceeded', line: 2, traceback: '' },
  },
  {
    label: 'Generator consumed twice',
    error: { type: 'StopIteration', message: '', line: 5, traceback: '' },
  },
  {
    label: 'Runaway loop (our timeout)',
    error: { type: 'KeyboardInterrupt', message: '', line: 1, traceback: '' },
  },
  {
    label: 'input() with nothing left to read',
    error: { type: 'EOFError', message: 'EOF when reading a line', line: 1, traceback: '' },
  },
  {
    label: 'Timed out waiting for input()',
    error: { type: 'OSError', message: '[Errno 29] I/O error', line: 1, traceback: '' },
  },
  {
    label: 'Blocked import',
    error: { type: 'ModuleNotFoundError', message: "No module named 'requests'", line: 1, traceback: '' },
  },
]
