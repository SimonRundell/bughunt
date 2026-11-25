<?php
/**
 * Compares a stored `expect_py` string (a Python literal, as authored in
 * bh_puzzle_tests - see BUILD.md 4.5's Expectation kinds table) against a
 * value sent by the browser, without ever needing a Python interpreter on
 * the server. Used by api/grade_hidden_test.php so a hidden test's expected
 * value never has to leave the server to be checked.
 *
 * `expect_py` only ever needs to express the JSON-compatible subset of
 * Python literals (numbers, True/False/None, single- or double-quoted
 * strings, lists, tuples, dicts) - every test in the puzzle bank already
 * authors it that way. bh_normalize_python_literal() rewrites that subset
 * into real JSON text (quote style, True/False/None) without touching
 * anything inside a string literal, so json_decode() can take it from
 * there. Anything outside that subset (a set literal, a bare tuple using
 * parens, an f-string, ...) is deliberately not supported - the normalizer
 * returns null and the caller fails closed (see bh_grade_returns below).
 */

/**
 * Rewrites the Python-literal subset above into JSON text.
 * @param string $py
 * @return string|null null if $py uses syntax outside the supported subset.
 */
function bh_normalize_python_literal(string $py): ?string
{
    $len = strlen($py);
    $out = '';
    $i = 0;
    $inString = false;
    $quote = '';

    while ($i < $len) {
        $ch = $py[$i];

        if ($inString) {
            if ($ch === '\\' && $i + 1 < $len) {
                // Keep backslash escapes as-is; JSON and Python agree on
                // \n \t \r \\ \/ and \uXXXX, and json_decode handles \' as
                // a bare quote too (it's not a JSON escape, but PHP's
                // json_decode accepts it as literal `'`... to be safe we
                // normalise \' to a plain ' ourselves instead of relying on that).
                $next = $py[$i + 1];
                if ($quote === "'" && $next === "'") {
                    $out .= "'";
                    $i += 2;
                    continue;
                }
                if ($next === '"' && $quote === "'") {
                    // An unescaped-in-Python double quote inside a single-quoted
                    // string must be escaped for JSON.
                    $out .= '\\"';
                    $i += 2;
                    continue;
                }
                $out .= $ch . $next;
                $i += 2;
                continue;
            }
            if ($ch === $quote) {
                $out .= '"';
                $inString = false;
                $i++;
                continue;
            }
            if ($quote === "'" && $ch === '"') {
                // A bare double quote inside a Python single-quoted string
                // must be escaped once we re-wrap it in double quotes.
                $out .= '\\"';
                $i++;
                continue;
            }
            $out .= $ch;
            $i++;
            continue;
        }

        if ($ch === '"' || $ch === "'") {
            $inString = true;
            $quote = $ch;
            $out .= '"';
            $i++;
            continue;
        }

        if ($ch === '(') {
            // Treat a parenthesised literal as a JSON array (tuple vs list
            // isn't a distinction this puzzle bank's tests rely on).
            $out .= '[';
            $i++;
            continue;
        }
        if ($ch === ')') {
            $out .= ']';
            $i++;
            continue;
        }

        // Bare identifiers: True / False / None, outside any string.
        if (preg_match('/\G(True|False|None)\b/', $py, $m, 0, $i)) {
            $out .= $m[1] === 'True' ? 'true' : ($m[1] === 'False' ? 'false' : 'null');
            $i += strlen($m[1]);
            continue;
        }

        // A bare numeric dict key (Python allows int keys; JSON requires
        // string keys). Only `:` legitimately follows a key in this
        // grammar subset, so a digit run right before one is always a key.
        // json.dumps() on the client side stringifies int dict keys the
        // same way, so both sides end up comparable as string keys.
        if (preg_match('/\G(-?\d+)(\s*):/', $py, $m, 0, $i)) {
            $out .= '"' . $m[1] . '"' . $m[2] . ':';
            $i += strlen($m[0]);
            continue;
        }

        // Anything else (numbers, punctuation, whitespace) carries through
        // unchanged - valid in both Python-literal and JSON syntax.
        $out .= $ch;
        $i++;
    }

    if ($inString) {
        return null; // unterminated string - malformed input
    }

    // A trailing comma before ] or } is valid Python but not valid JSON
    // (e.g. a single-element tuple "(1,)" -> "[1,]").
    $out = preg_replace('/,(\s*[\]}])/', '$1', $out);

    return $out;
}

/**
 * Decodes a Python *string* literal (quoted, possibly with escapes) into
 * its raw text - used for `stdout` tests, where expect_py is always a
 * single quoted string, never a compound literal.
 * @param string $py
 * @return string|null null if $py isn't a single quoted string literal.
 */
function bh_decode_python_string_literal(string $py): ?string
{
    $normalized = bh_normalize_python_literal($py);
    if ($normalized === null) {
        return null;
    }
    $decoded = json_decode($normalized, true);
    return is_string($decoded) ? $decoded : null;
}

/**
 * Parses a Python literal (per the supported subset) into a native PHP
 * value (null/bool/int/float/string/array), or returns the sentinel
 * BH_LITERAL_UNSUPPORTED if $py falls outside that subset.
 * @param string $py
 * @return mixed
 */
function bh_parse_python_literal(string $py)
{
    $normalized = bh_normalize_python_literal($py);
    if ($normalized === null) {
        return BH_LITERAL_UNSUPPORTED;
    }
    // json_decode distinguishes "malformed JSON" from "literal JSON null"
    // only via json_last_error(), so check that rather than trust the
    // return value alone.
    $decoded = json_decode($normalized, true);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        return BH_LITERAL_UNSUPPORTED;
    }
    return $decoded;
}

define('BH_LITERAL_UNSUPPORTED', "\0BH_LITERAL_UNSUPPORTED\0");

/**
 * Python-`==`-equivalent comparison between a parsed expected value and a
 * parsed actual value (both already run through bh_parse_python_literal()
 * or decoded from the client's own JSON), with math.isclose-style
 * tolerance for numbers when $floatTol is true.
 *
 * Mirrors harness.py's _float_tol_eq: math.isclose(a, b, rel_tol=1e-9).
 *
 * @param mixed $expected
 * @param mixed $actual
 * @param bool $floatTol
 */
function bh_values_equal($expected, $actual, bool $floatTol): bool
{
    if (is_int($expected) || is_float($expected) || is_int($actual) || is_float($actual)) {
        if (!is_numeric($expected) || !is_numeric($actual)) {
            return false;
        }
        // Python distinguishes bool from int/float for `==` purposes only
        // in that True == 1 and False == 0 (bool *is* a numeric subtype in
        // Python), which is what this numeric branch already gives us.
        $a = (float) $expected;
        $b = (float) $actual;
        if ($floatTol) {
            $relTol = 1e-9;
            return abs($a - $b) <= max($relTol * max(abs($a), abs($b)), 0.0);
        }
        return $a === $b || (is_int($expected) && is_int($actual) && $expected === $actual);
    }

    if (is_bool($expected) || is_bool($actual)) {
        return $expected === $actual;
    }

    if ($expected === null || $actual === null) {
        return $expected === $actual;
    }

    if (is_string($expected) || is_string($actual)) {
        return is_string($expected) && is_string($actual) && $expected === $actual;
    }

    if (is_array($expected) && is_array($actual)) {
        $expectedIsList = array_is_list($expected);
        $actualIsList = array_is_list($actual);
        if ($expectedIsList !== $actualIsList) {
            return false;
        }
        if ($expectedIsList) {
            if (count($expected) !== count($actual)) {
                return false;
            }
            foreach ($expected as $idx => $value) {
                if (!bh_values_equal($value, $actual[$idx], $floatTol)) {
                    return false;
                }
            }
            return true;
        }
        if (count($expected) !== count($actual)) {
            return false;
        }
        foreach ($expected as $key => $value) {
            if (!array_key_exists($key, $actual)) {
                return false;
            }
            if (!bh_values_equal($value, $actual[$key], $floatTol)) {
                return false;
            }
        }
        return true;
    }

    return false;
}

/**
 * Mirrors harness.py's _trim_stdout: strips trailing whitespace from each
 * line, then from the whole text.
 */
function bh_trim_stdout_text(string $text): string
{
    $lines = explode("\n", $text);
    $lines = array_map('rtrim', $lines);
    return rtrim(implode("\n", $lines));
}
