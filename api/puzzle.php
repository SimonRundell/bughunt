<?php
/**
 * GET ?slug= -> one published puzzle's playable detail: brief, buggy
 * code, entry mode/name, tests (hidden ones flagged, not stripped - a
 * soft control per BUILD.md 5.3, not real security), hint count, bug
 * count, predict prompt, concept slugs. Never includes fixed_code, bug
 * descriptions or hint text - those are separate calls (solution.php,
 * hint.php) only fetched when the student actually asks for them.
 */
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib/response.php';

$slug = $_GET['slug'] ?? '';
if (!is_string($slug) || $slug === '') {
    bh_error('missing_slug', 'Provide a ?slug=.', 422);
}

$pdo = bh_db();

$stmt = $pdo->prepare(
    "SELECT p.id, p.slug, t.slug AS track, p.title, p.difficulty, p.bug_type, p.entry_mode, p.entry_name,
            p.brief_md, p.buggy_code, p.predict_prompt_md, p.xp
     FROM bh_puzzles p
     JOIN bh_tracks t ON t.id = p.track_id
     WHERE p.slug = :slug AND p.status = 'published'",
);
$stmt->execute(['slug' => $slug]);
$puzzle = $stmt->fetch();

if (!$puzzle) {
    bh_error('not_found', 'No published puzzle with that slug.', 404);
}

$testsStmt = $pdo->prepare(
    'SELECT label, args_py, kwargs_py, stdin_text, expect_kind, expect_py, compare_mode, is_hidden
     FROM bh_puzzle_tests WHERE puzzle_id = :id ORDER BY sort_order',
);
$testsStmt->execute(['id' => $puzzle['id']]);
$tests = array_map(static function (array $t): array {
    $t['hidden'] = (bool) $t['is_hidden'];
    unset($t['is_hidden']);
    return $t;
}, $testsStmt->fetchAll());

$hintCountStmt = $pdo->prepare('SELECT COUNT(*) FROM bh_hints WHERE puzzle_id = :id');
$hintCountStmt->execute(['id' => $puzzle['id']]);

$bugCountStmt = $pdo->prepare('SELECT COUNT(*) FROM bh_puzzle_bugs WHERE puzzle_id = :id');
$bugCountStmt->execute(['id' => $puzzle['id']]);

$conceptsStmt = $pdo->prepare(
    'SELECT c.slug FROM bh_puzzle_concepts pc JOIN bh_concepts c ON c.id = pc.concept_id WHERE pc.puzzle_id = :id',
);
$conceptsStmt->execute(['id' => $puzzle['id']]);

bh_ok([
    'slug' => $puzzle['slug'],
    'track' => $puzzle['track'],
    'title' => $puzzle['title'],
    'difficulty' => (int) $puzzle['difficulty'],
    'bug_type' => $puzzle['bug_type'],
    'entry_mode' => $puzzle['entry_mode'],
    'entry_name' => $puzzle['entry_name'],
    'brief_md' => $puzzle['brief_md'],
    'buggy_code' => $puzzle['buggy_code'],
    'predict_prompt_md' => $puzzle['predict_prompt_md'],
    'xp' => $puzzle['xp'] !== null ? (int) $puzzle['xp'] : null,
    'tests' => $tests,
    'hint_count' => (int) $hintCountStmt->fetchColumn(),
    'bug_count' => (int) $bugCountStmt->fetchColumn(),
    'concepts' => array_column($conceptsStmt->fetchAll(), 'slug'),
]);
