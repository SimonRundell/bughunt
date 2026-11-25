<?php
/**
 * POST { slug, testId, raisedType?, stdout?, actual? } -> { passed: bool }
 *
 * Grades one hidden test's already-captured result (BUILD.md 4.5/5.3): the
 * student's code still runs only in their own browser, via Pyodide - this
 * endpoint never executes student code and is never told the full test
 * suite. It receives only what running the student's code already
 * produced (an exception type name, captured stdout, or a JSON-safe
 * return value) and compares that, server-side, against the one hidden
 * test's stored expect_py - which is never sent back to the browser.
 *
 * The caller's own belief about expect_kind/compare_mode is not trusted;
 * both are re-read from bh_puzzle_tests here, keyed by testId, so a forged
 * request can't claim an easier comparison than the test actually uses.
 */
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib/response.php';
require_once __DIR__ . '/lib/py_literal_compare.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    bh_error('method_not_allowed', 'Use POST.', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    $body = [];
}

$slug = is_string($body['slug'] ?? null) ? $body['slug'] : '';
$testId = (int) ($body['testId'] ?? 0);
if ($slug === '' || $testId <= 0) {
    bh_error('invalid_params', 'Provide slug and testId.', 422);
}

$pdo = bh_db();
$stmt = $pdo->prepare(
    "SELECT t.expect_kind, t.expect_py, t.compare_mode
     FROM bh_puzzle_tests t
     JOIN bh_puzzles p ON p.id = t.puzzle_id
     WHERE t.id = :test_id AND p.slug = :slug AND p.status = 'published' AND t.is_hidden = 1",
);
$stmt->execute(['test_id' => $testId, 'slug' => $slug]);
$test = $stmt->fetch();

if (!$test) {
    // Also covers "that id belongs to a different puzzle" and "that id is
    // a visible test" - both should look identical to a caller probing ids.
    bh_error('not_found', 'No hidden test with that id for this puzzle.', 404);
}

$raisedType = is_string($body['raisedType'] ?? null) ? $body['raisedType'] : null;
$stdout = is_string($body['stdout'] ?? null) ? $body['stdout'] : '';
$hasActual = array_key_exists('actual', $body);
$actual = $body['actual'] ?? null;

$passed = false;

if ($test['expect_kind'] === 'raises') {
    $passed = $raisedType !== null && trim($test['expect_py']) === $raisedType;
} elseif ($test['expect_kind'] === 'stdout') {
    $expectedText = bh_decode_python_string_literal($test['expect_py']);
    if ($expectedText !== null) {
        $passed = $test['compare_mode'] === 'trim_stdout'
            ? bh_trim_stdout_text($stdout) === bh_trim_stdout_text($expectedText)
            : $stdout === $expectedText;
    }
} elseif ($test['expect_kind'] === 'returns' && $hasActual) {
    $expected = bh_parse_python_literal($test['expect_py']);
    if ($expected !== BH_LITERAL_UNSUPPORTED) {
        $passed = bh_values_equal($expected, $actual, $test['compare_mode'] === 'float_tol');
    }
}

bh_ok(['passed' => $passed]);
