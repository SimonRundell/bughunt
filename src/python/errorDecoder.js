/**
 * Translates a Python error (as reported by harness.py) into a plain-
 * English explanation for a 16-year-old. Matches on exception type first,
 * then on message pattern. Never reveals a puzzle's specific fix - only
 * general behaviour of the error itself (BUILD.md 4.7, "no spoilers").
 *
 * Patterns are verified against real Pyodide 314.0.8 (Python 3.14.2)
 * output in errorFixtures.js; see /dev/errors (dev-only) to render them.
 */

/**
 * @typedef {object} DecodedError
 * @property {string} title
 * @property {string} plain
 * @property {string[]} causes
 * @property {string} whereToLook
 * @property {string} conceptSlug
 */

/**
 * @param {{type: string, message: string, line: number|null, traceback: string}} error
 * @returns {DecodedError}
 */
export function decodeError(error) {
  const { type, message } = error
  const rules = RULES[type]
  if (rules) {
    for (const rule of rules) {
      if (!rule.match || rule.match.test(message)) {
        return typeof rule.result === 'function' ? rule.result(message) : rule.result
      }
    }
  }
  return FALLBACK(type, message)
}

const FALLBACK = (type, message) => ({
  title: type || 'Error',
  plain: `Python raised a ${type}: ${message}`,
  causes: ['This exact message pattern isn\'t in the decoder yet.'],
  whereToLook: 'Read the traceback from the bottom up - the last line names the error, the lines above show where it happened.',
  conceptSlug: 'reading-tracebacks',
})

const RULES = {
  SyntaxError: [
    {
      match: /expected ':'/,
      result: {
        title: "Missing colon",
        plain: "Python expected a colon ':' at the end of this line and didn't find one.",
        causes: [
          "An if, elif, else, for, while, def or class line with no colon at the end.",
        ],
        whereToLook: 'Look at the line the error points to - it needs a colon before the indented block starts.',
        conceptSlug: 'block-syntax',
      },
    },
    {
      match: /unterminated string literal|EOL while scanning string literal/,
      result: {
        title: 'Unterminated string',
        plain: "A string was opened with a quote mark but never closed before the line ended.",
        causes: ["A missing closing \" or '.", "A quote mark used inside the string that matches the opening quote."],
        whereToLook: 'Check the quotes on the reported line - count them in pairs.',
        conceptSlug: 'strings-quotes',
      },
    },
    {
      match: /was never closed/,
      result: {
        title: 'Unclosed bracket',
        plain: "A bracket, bracket or parenthesis was opened but never closed.",
        causes: ["A missing ) ] or }.", "Brackets closed in the wrong order."],
        whereToLook: "Python points at where the bracket opened - find its matching close.",
        conceptSlug: 'unclosed-brackets',
      },
    },
    {
      match: /cannot assign to|maybe you meant '=='/i,
      result: {
        title: 'Used = instead of ==',
        plain: "= assigns a value to a variable. == compares two values. Python thinks you're trying to assign to something that can't be assigned to, usually because you meant to compare.",
        causes: ["Writing if x = 5: instead of if x == 5:."],
        whereToLook: 'Look for = inside a condition (if/while) on the reported line.',
        conceptSlug: 'assignment-vs-comparison',
      },
    },
    {
      match: /invalid decimal literal/,
      result: {
        title: 'Invalid number',
        plain: "Python found a number written in a way it can't parse - often a number running straight into a variable name with nothing between them.",
        causes: ['Something like 10x or 3abc with no operator or space.'],
        whereToLook: 'Check the reported line for a number stuck directly next to letters.',
        conceptSlug: 'keywords',
      },
    },
    {
      match: /invalid syntax/,
      result: {
        title: 'Invalid syntax',
        plain: "Python couldn't make sense of this line's structure at all - a general catch-all for 'this isn't valid Python'.",
        causes: ['A missing comma, a stray keyword, mismatched brackets, or a typo in a keyword (e.g. elseif instead of elif).'],
        whereToLook: "Read the line Python points to, and the one just before it - the real mistake is often just above the reported position.",
        conceptSlug: 'keywords',
      },
    },
  ],
  IndentationError: [
    {
      match: /expected an indented block/,
      result: {
        title: 'Missing indentation',
        plain: "Python expected the next line to be indented (to start a block after a colon) and it wasn't.",
        causes: ['A line ending in : with nothing indented underneath it.'],
        whereToLook: 'Indent the line(s) that should belong inside the block above.',
        conceptSlug: 'indentation',
      },
    },
    {
      match: /unexpected indent/,
      result: {
        title: 'Unexpected indentation',
        plain: 'A line is indented more than Python expects, with nothing above it that opens a new block.',
        causes: ['Extra spaces or a stray tab at the start of a line.'],
        whereToLook: 'Compare this line\'s indentation to the lines around it.',
        conceptSlug: 'indentation',
      },
    },
    {
      match: /unindent does not match/,
      result: {
        title: 'Indentation doesn\'t line up',
        plain: "This line's indentation doesn't match any of the enclosing blocks - Python can't tell which block it belongs to.",
        causes: ['Mixing tabs and spaces, or an inconsistent number of spaces between lines that should be at the same level.'],
        whereToLook: 'Check this line lines up exactly with the block it should belong to.',
        conceptSlug: 'indentation',
      },
    },
  ],
  NameError: [
    {
      result: (message) => ({
        title: 'Name not found',
        plain: "Python doesn't recognise a name used here - it hasn't been defined (or was spelled differently) before this line runs.",
        causes: ['A typo in a variable or function name.', 'Using a name before it has been assigned.', 'Capitalisation that doesn\'t match (Python is case-sensitive).'],
        whereToLook: `Find where "${(message.match(/'([^']+)'/) || [])[1] ?? 'the name'}" should have been created, and compare the spelling exactly.`,
        conceptSlug: 'names-and-scope',
      }),
    },
  ],
  UnboundLocalError: [
    {
      result: {
        title: 'Local variable used before assignment',
        plain: 'Inside a function, a variable is used before it has been given a value in that same function - even if a variable with the same name exists outside it.',
        causes: ['A variable is only assigned on one branch of an if/else and used on another.', 'A variable with the same name exists globally, but assigning to it anywhere inside the function makes Python treat it as local throughout.'],
        whereToLook: 'Check every path through the function assigns the variable before it is read.',
        conceptSlug: 'names-and-scope',
      },
    },
  ],
  TypeError: [
    {
      match: /unsupported operand type/,
      result: {
        title: "Operator doesn't work on these types",
        plain: "An operator like + - * / was used on two values of types that don't support it together.",
        causes: ['Adding a string and a number without converting one of them.', 'Mixing a list and a number.'],
        whereToLook: 'Check the types of both values around the operator - use str(), int() or float() to convert.',
        conceptSlug: 'types-and-conversion',
      },
    },
    {
      match: /can only concatenate/,
      result: {
        title: 'Can\'t join a string and a non-string',
        plain: "+ between strings joins them, but one side here isn't a string.",
        causes: ['Writing "Age: " + age where age is a number instead of "Age: " + str(age).'],
        whereToLook: 'Wrap the non-string value in str() before joining it.',
        conceptSlug: 'types-and-conversion',
      },
    },
    {
      match: /is not callable/,
      result: {
        title: 'Tried to call something that isn\'t a function',
        plain: "Parentheses () were used after a value that isn't a function, so Python tried to call it and couldn't.",
        causes: ['A variable name shadows a built-in (e.g. a variable called list), then list(...) tries to call the variable instead of the built-in.', 'A typo adds brackets after the wrong name.'],
        whereToLook: 'Check what the name just before the ( actually refers to.',
        conceptSlug: 'shadowing-builtins',
      },
    },
    {
      match: /positional argument|takes \d+ positional|missing \d+ required/,
      result: {
        title: 'Wrong number of arguments',
        plain: "A function was called with a different number of arguments than it's defined to accept.",
        causes: ['Forgetting an argument.', 'Adding an extra argument.', 'Confusing a method that needs self with a plain function call.'],
        whereToLook: 'Compare the function call to its def line - count the arguments on both sides.',
        conceptSlug: 'function-calls',
      },
    },
    {
      match: /not subscriptable/,
      result: {
        title: "Can't index into this value",
        plain: "Square brackets [] were used on a value that doesn't support indexing - often because a function that should have returned something returned None.",
        causes: ['A function is missing a return statement, so it returns None, and the code then tries to index into that None.'],
        whereToLook: "Check what's actually stored in the variable right before the [..] - is it what you expect, or is it None?",
        conceptSlug: 'return-values',
      },
    },
  ],
  ValueError: [
    {
      match: /invalid literal for int\(\)/,
      result: {
        title: "Can't convert that text to a number",
        plain: "int(...) was given text that isn't a valid whole number.",
        causes: ['Text containing a decimal point (use float() instead).', 'Text with letters, spaces, or punctuation mixed in.', 'Input from input() that the user didn\'t type as expected.'],
        whereToLook: 'Check exactly what string is being passed to int() - print it first if unsure.',
        conceptSlug: 'input-validation',
      },
    },
  ],
  IndexError: [
    {
      result: {
        title: 'Index out of range',
        plain: 'A list (or string) was indexed with a position that doesn\'t exist - the index is too big, or the list is empty.',
        causes: ['Using len(list) as an index (valid indexes stop at len(list) - 1).', 'Indexing an empty list.', 'An off-by-one mistake in a loop.'],
        whereToLook: 'Check the size of the list and the index value right before the [..] runs.',
        conceptSlug: 'indexing',
      },
    },
  ],
  KeyError: [
    {
      result: (message) => ({
        title: 'Key not found in dictionary',
        plain: `A dictionary was asked for a key it doesn't have${message ? ` (${message})` : ''}.`,
        causes: ['A typo in the key name.', 'The key genuinely hasn\'t been added yet.', 'Capitalisation or spacing differs from how the key was stored.'],
        whereToLook: 'Check how the dictionary was built, and compare the key spelling exactly - or use .get() with a default to avoid the crash.',
        conceptSlug: 'dictionaries',
      }),
    },
  ],
  AttributeError: [
    {
      match: /NoneType/,
      result: {
        title: "Tried to use an attribute on None",
        plain: 'A method or attribute was used on a value that turned out to be None - usually the result of a function that fell through without returning anything.',
        causes: ['Forgetting a return statement.', 'A method that modifies a list in place (like .sort() or .append()) returns None - don\'t assign its result back to the variable.'],
        whereToLook: 'Trace back where this value came from and check it\'s not None before using it.',
        conceptSlug: 'return-values',
      },
    },
    {
      result: {
        title: 'Attribute not found',
        plain: "A value doesn't have the attribute or method that was asked for.",
        causes: ['A typo in a method name.', 'Calling a method that belongs to a different type (e.g. a string method on a list).'],
        whereToLook: 'Check the type of the value and the exact spelling of the attribute.',
        conceptSlug: 'types-and-conversion',
      },
    },
  ],
  ZeroDivisionError: [
    {
      result: {
        title: 'Division by zero',
        plain: 'A division (or modulo) was attempted with zero as the divisor, which Python never allows.',
        causes: ['Dividing by a count that turned out to be zero, e.g. the average of an empty list.'],
        whereToLook: 'Check the value on the right of / or % - add a guard for the zero case.',
        conceptSlug: 'zero-division-and-guards',
      },
    },
  ],
  RecursionError: [
    {
      result: {
        title: 'Too much recursion',
        plain: "A function kept calling itself and never stopped, until Python hit its recursion limit.",
        causes: ['A missing or unreachable base case.', 'The recursive call doesn\'t move any closer to the base case.'],
        whereToLook: 'Check the base case exists and that every recursive call gets closer to it.',
        conceptSlug: 'recursion',
      },
    },
  ],
  StopIteration: [
    {
      result: {
        title: 'Iterator exhausted',
        plain: "next() was called on an iterator (like a generator) that had already produced its last value.",
        causes: ['Calling next() one time too many.', 'A generator consumed once already being iterated again.'],
        whereToLook: 'Check how many times this iterator is consumed, and whether it needs recreating.',
        conceptSlug: 'iterators-and-generators',
      },
    },
  ],
  OSError: [
    {
      match: /\[Errno 29\]/,
      result: {
        title: 'Stopped: timed out waiting for input',
        plain: "This run was waiting for an answer to input() and nobody typed one before the time limit, so it was stopped.",
        causes: ['No answer was typed into the prompt before the run timed out.'],
        whereToLook: 'Run it again and type an answer as soon as the prompt appears.',
        conceptSlug: 'input-validation',
      },
    },
  ],
  KeyboardInterrupt: [
    {
      result: {
        title: 'Stopped: took too long',
        plain: "This run was stopped because it didn't finish in time - almost always a loop that never ends.",
        causes: ['A while loop whose condition never becomes false.', 'A missing increment/update inside the loop body.'],
        whereToLook: 'Check every loop\'s condition actually changes based on something the loop body updates.',
        conceptSlug: 'loop-termination',
      },
    },
  ],
  EOFError: [
    {
      result: {
        title: 'Ran out of input',
        plain: "input() was called but there was no more input left to give it.",
        causes: ['The program calls input() more times than the student supplied answers for.'],
        whereToLook: 'Count how many times input() is called versus how many answers were provided.',
        conceptSlug: 'input-validation',
      },
    },
  ],
  ModuleNotFoundError: [
    {
      result: {
        title: 'Module not available here',
        plain: "This import isn't on the allowed list for BugHunt's Python runtime, so it can't be loaded.",
        causes: ['Only a fixed set of standard-library modules is available (see the Playground footer for the list).'],
        whereToLook: 'Check the import against the allowed-modules list.',
        conceptSlug: 'keywords',
      },
    },
  ],
}
