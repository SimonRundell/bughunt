"""
Runs inside Pyodide. `run_script` executes student code as a fresh
top-level script (like running a .py file): __name__ is "__main__", so
`if __name__ == "__main__":` blocks run. stdout/stderr are not touched
here; the worker wires those through pyodide.setStdout/setStderr before
calling in.

`run_one_test` runs a single test case against the student's code (BUILD.md
4.5): a fresh namespace per test, `expect_kind`/`compare_mode` handling, and
`stdin_text` fed to input() instead of the interactive reader. The worker
calls it once per test (not all tests in one call) so the main thread can
post `testStart`/`testResult` messages and apply a per-test timeout.
"""

import ast
import io
import json
import math
import sys
import time
import traceback


def run_script(code):
    """
    Returns a JSON string: {"ok": true} on success, or
    {"ok": false, "error": {type, message, line, col, traceback}}.
    JSON (not a Python dict) crosses the Pyodide/JS boundary as a plain
    string, with no PyProxy to manage on the JS side.
    """
    g = {"__name__": "__main__"}
    try:
        compiled = compile(code, "<student>", "exec")
    except SyntaxError as exc:
        return json.dumps({"ok": False, "error": _describe(exc)})

    try:
        exec(compiled, g)
    except BaseException as exc:
        return json.dumps({"ok": False, "error": _describe(exc)})

    return json.dumps({"ok": True})


def run_one_test(code, entry_mode, entry_name, test_json):
    """
    Runs one test case in a fresh namespace. `test_json` is a JSON object:
    {label, args_py, kwargs_py, stdin_text, expect_kind, expect_py, compare_mode}.

    Returns a JSON string:
    {"passed": bool, "expected": ..., "actual": ..., "stdout": str,
     "error": {type, message, line, col, traceback} | null, "ms": number}

    `error` is only set for a genuine crash (one not matching a `raises`
    expectation) - a correctly-raised or wrongly-raised exception for a
    `raises` test is a pass/fail outcome, not an error to display.
    """
    test = json.loads(test_json)
    expect_kind = test["expect_kind"]
    compare_mode = test.get("compare_mode") or "exact"
    stdin_text = test.get("stdin_text") or ""

    start = time.perf_counter()

    old_stdin, old_stdout, old_stderr = sys.stdin, sys.stdout, sys.stderr
    sys.stdin = io.StringIO(stdin_text)
    out_buf, err_buf = io.StringIO(), io.StringIO()
    sys.stdout, sys.stderr = out_buf, err_buf

    namespace_name = "__main__" if entry_mode == "script" else "student"
    g = {"__name__": namespace_name}

    actual = None
    error = None
    raised_type = None

    try:
        compiled = compile(code, "<student>", "exec")
        exec(compiled, g)

        if entry_mode == "function":
            fn = g.get(entry_name)
            if not callable(fn):
                raise NameError(f"Your code must define a function called `{entry_name}`")
            args = ast.literal_eval(test["args_py"]) if test.get("args_py") else ()
            kwargs = ast.literal_eval(test["kwargs_py"]) if test.get("kwargs_py") else {}
            actual = fn(*args, **kwargs)
    except BaseException as exc:
        raised_type = type(exc).__name__
        error = _describe(exc)
    finally:
        sys.stdin, sys.stdout, sys.stderr = old_stdin, old_stdout, old_stderr

    stdout_text = out_buf.getvalue()
    elapsed_ms = (time.perf_counter() - start) * 1000

    passed = False
    expected_display = None
    actual_display = None

    if expect_kind == "raises":
        expected_display = test["expect_py"]
        actual_display = raised_type
        passed = raised_type == test["expect_py"]
        if passed:
            error = None
    elif error is not None:
        passed = False
        expected_display = _try_literal(test["expect_py"])
    elif expect_kind == "returns":
        expected_display = ast.literal_eval(test["expect_py"])
        actual_display = actual
        if compare_mode == "float_tol":
            passed = _float_tol_eq(actual, expected_display)
        else:
            passed = actual == expected_display
    elif expect_kind == "stdout":
        expected_display = ast.literal_eval(test["expect_py"])
        actual_display = stdout_text
        if compare_mode == "trim_stdout":
            passed = _trim_stdout(actual_display) == _trim_stdout(expected_display)
        else:
            passed = actual_display == expected_display

    result = {
        "passed": bool(passed),
        "expected": expected_display,
        "actual": actual_display,
        "stdout": stdout_text,
        "error": error,
        "ms": elapsed_ms,
    }
    return json.dumps(result, cls=_SafeEncoder)


def _try_literal(text):
    try:
        return ast.literal_eval(text)
    except (ValueError, SyntaxError):
        return text


def _float_tol_eq(actual, expected):
    try:
        return math.isclose(actual, expected, rel_tol=1e-9)
    except TypeError:
        return actual == expected


def _trim_stdout(text):
    """Strips trailing whitespace from each line, then from the whole text."""
    lines = text.split("\n")
    return "\n".join(line.rstrip() for line in lines).rstrip()


class _SafeEncoder(json.JSONEncoder):
    """Falls back to repr() for anything json can't natively encode
    (sets, custom objects) rather than failing the whole test result."""

    def default(self, obj):
        return repr(obj)


def _describe(exc):
    line = getattr(exc, "lineno", None)
    col = getattr(exc, "offset", None)

    if line is None:
        tb = exc.__traceback__
        last_in_student = None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == "<student>":
                last_in_student = tb
            tb = tb.tb_next
        if last_in_student is not None:
            line = last_in_student.tb_lineno

    return {
        "type": type(exc).__name__,
        "message": str(exc),
        "line": line,
        "col": col,
        "traceback": "".join(
            traceback.format_exception(type(exc), exc, exc.__traceback__)
        ),
    }
