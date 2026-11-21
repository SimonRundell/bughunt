<?php
/**
 * POST { id } -> records a successful in-browser verification (BUILD.md
 * 8): the admin UI runs the actual checks itself (fixed_code passes every
 * test, buggy_code fails at least one, buggy/fixed differ, bug line
 * numbers are in range) using the same Pyodide runner students use - this
 * endpoint's only job is to stamp the *current* content with a hash once
 * the browser confirms all of that passed, so a later edit can detect it
 * needs re-verifying.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/puzzle_hash.php';

bh_require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    bh_error('method_not_allowed', 'Use POST.', 405);
}

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$id = (int) ($body['id'] ?? 0);
if ($id <= 0) {
    bh_error('invalid_id', 'Provide an id.', 422);
}

$pdo = bh_db();
$stmt = $pdo->prepare('SELECT buggy_code, fixed_code, entry_mode, entry_name FROM bh_puzzles WHERE id = :id');
$stmt->execute(['id' => $id]);
$puzzle = $stmt->fetch();
if (!$puzzle) {
    bh_error('not_found', 'No puzzle with that id.', 404);
}

$testsStmt = $pdo->prepare('SELECT * FROM bh_puzzle_tests WHERE puzzle_id = :id');
$testsStmt->execute(['id' => $id]);
$tests = $testsStmt->fetchAll();

if (count($tests) === 0) {
    bh_error('no_tests', 'Add at least one test before verifying.', 422);
}
if ($puzzle['buggy_code'] === $puzzle['fixed_code']) {
    bh_error('identical_code', "Buggy and fixed code must differ.", 422);
}

$hash = bh_puzzle_verification_hash($puzzle, $tests);
$pdo->prepare('UPDATE bh_puzzles SET verified_hash = :hash, verified_at = NOW() WHERE id = :id')
    ->execute(['hash' => $hash, 'id' => $id]);

bh_ok(['verified' => true]);
