<?php
/**
 * Regression test for api/lib/py_literal_compare.php (the server-side
 * grading logic used by api/grade_hidden_test.php). No test framework
 * dependency - run directly: `php scripts/test-py-literal-compare.php`.
 * Exits non-zero on any failure, so it's CI-able once CI exists.
 *
 * Covers: the literal subset this puzzle bank's expect_py already uses
 * (bools, None, ints/floats, both quote styles with escapes, lists,
 * dicts with string or bare-numeric keys), math.isclose-style float_tol,
 * and that unsupported syntax (e.g. a Python set) fails closed rather
 * than being silently misparsed. Also re-checks every hidden test's
 * expect_py actually in api/sql/seed.sql, so a future admin-authored test
 * using unsupported syntax gets caught here instead of silently failing
 * to grade in production.
 */

require __DIR__ . '/../api/lib/py_literal_compare.php';

$failures = 0;

function check(bool $ok, string $label): void
{
    global $failures;
    if ($ok) {
        echo "ok:   $label\n";
    } else {
        $failures++;
        echo "FAIL: $label\n";
    }
}

// --- literal parsing + exact equality -------------------------------------

$exactCases = [
    ['True', true],
    ['False', false],
    ['None', null],
    ['-8', -8],
    ['3.14', 3.14],
    ['""', ''],
    ['"Final score: 10\\n"', "Final score: 10\n"],
    ["'Ada\\n'", "Ada\n"],
    ["'It\\'s here'", "It's here"],
    ['"She said \\"hi\\""', 'She said "hi"'],
    ['["A", "B"]', ['A', 'B']],
    ["['a', 'b', 'c']", ['a', 'b', 'c']],
    ['["ca_", False]', ['ca_', false]],
    ['(1,)', [1]],
    ['{"word_count": 2, "avg_word_length": 5}', ['word_count' => 2, 'avg_word_length' => 5]],
    ['{1: 0, 2: 0, 3: 0}', ['1' => 0, '2' => 0, '3' => 0]], // bare numeric dict keys
];
foreach ($exactCases as [$py, $expected]) {
    $parsed = bh_parse_python_literal($py);
    $ok = $parsed !== BH_LITERAL_UNSUPPORTED && bh_values_equal($expected, $parsed, false);
    check($ok, "parse+compare: $py");
}

// --- float_tol (mirrors harness.py's math.isclose(rel_tol=1e-9)) ---------

$tolCases = [
    ['3.14159', 3.14159000001, true, true],
    ['20.39', 20.39, true, true],
    ['5', 5.0000000001, true, true],
    ['5', 5.1, true, false],
    ['3.14', 3.14159, true, false],
];
foreach ($tolCases as [$py, $actual, $floatTol, $expectPass]) {
    $parsed = bh_parse_python_literal($py);
    $ok = bh_values_equal($parsed, $actual, $floatTol) === $expectPass;
    check($ok, "float_tol: isclose($py, $actual) should be " . ($expectPass ? 'true' : 'false'));
}

// --- stdout string decoding + trim ----------------------------------------

check(bh_decode_python_string_literal('"Rex\\n"') === "Rex\n", 'decode stdout literal with \\n');
check(bh_trim_stdout_text("a \nb\t\n") === "a\nb", 'trim_stdout strips trailing whitespace per line and overall');

// --- fails closed on unsupported syntax -----------------------------------

check(bh_parse_python_literal('{1, 2, 3}') === BH_LITERAL_UNSUPPORTED, 'a Python set literal is rejected, not misparsed');

// --- every hidden test's real expect_py in the seed data still parses ----

$sql = file_get_contents(__DIR__ . '/../api/sql/seed.sql');
$checked = 0;
$unsupported = 0;
foreach (explode("\n", $sql) as $line) {
    if (strpos($line, 'INSERT INTO bh_puzzle_tests') !== 0) {
        continue;
    }
    if (!preg_match('/VALUES \((.*)\);\s*$/', $line, $m)) {
        continue;
    }
    $fields = bh_split_sql_tuple($m[1]);
    if (count($fields) !== 10) {
        continue;
    }
    $expectKind = trim($fields[6], "'");
    $isHidden = trim($fields[9]);
    if ($isHidden !== '1' || $expectKind === 'raises') {
        continue;
    }
    $inner = $fields[7];
    if (strlen($inner) >= 2 && $inner[0] === "'" && $inner[strlen($inner) - 1] === "'") {
        $inner = substr($inner, 1, -1);
    }
    $py = str_replace("''", "'", $inner);

    $checked++;
    if (bh_parse_python_literal($py) === BH_LITERAL_UNSUPPORTED) {
        $unsupported++;
        echo "FAIL: seed.sql hidden test uses unsupported syntax: $py\n";
    }
}
check($checked > 0, 'found hidden-test rows in seed.sql to check');
check($unsupported === 0, "all $checked hidden-test expect_py values in seed.sql parse ($unsupported unsupported)");

echo $failures === 0 ? "\nALL PASS\n" : "\n$failures FAILURE(S)\n";
exit($failures === 0 ? 0 : 1);

/**
 * Splits one SQL INSERT VALUES tuple into its top-level fields, respecting
 * '...'-quoted strings (with SQL's '' escaping) and nested parens so commas
 * inside them don't split early.
 * @return string[]
 */
function bh_split_sql_tuple(string $tuple): array
{
    $fields = [];
    $depth = 0;
    $inStr = false;
    $cur = '';
    for ($i = 0, $n = strlen($tuple); $i < $n; $i++) {
        $c = $tuple[$i];
        if ($inStr) {
            $cur .= $c;
            if ($c === "'") {
                if ($i + 1 < $n && $tuple[$i + 1] === "'") {
                    $cur .= $tuple[++$i];
                    continue;
                }
                $inStr = false;
            }
            continue;
        }
        if ($c === "'") {
            $inStr = true;
            $cur .= $c;
            continue;
        }
        if ($c === '(') {
            $depth++;
            $cur .= $c;
            continue;
        }
        if ($c === ')') {
            $depth--;
            $cur .= $c;
            continue;
        }
        if ($c === ',' && $depth === 0) {
            $fields[] = trim($cur);
            $cur = '';
            continue;
        }
        $cur .= $c;
    }
    $fields[] = trim($cur);
    return $fields;
}
