<?php
/**
 * GET -> the full content bundle (tracks, concepts, puzzles with nested
 * tests/hints/bugs/concepts) as JSON, in the same shape BUILD.md section 7
 * and import.php use - lets teachers share puzzle packs with each other.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

bh_require_admin();
$pdo = bh_db();

$tracks = $pdo->query('SELECT slug, title, summary, intro_md, bug_focus, assist_level, sort_order, status FROM bh_tracks ORDER BY sort_order')->fetchAll();
$concepts = $pdo->query('SELECT slug, title, summary, lesson_md FROM bh_concepts ORDER BY title')->fetchAll();

$trackSlugById = [];
foreach ($pdo->query('SELECT id, slug FROM bh_tracks') as $row) {
    $trackSlugById[$row['id']] = $row['slug'];
}

$puzzles = [];
$puzzleRows = $pdo->query('SELECT * FROM bh_puzzles ORDER BY track_id, sort_order')->fetchAll();
foreach ($puzzleRows as $p) {
    $testsStmt = $pdo->prepare('SELECT label, args_py, kwargs_py, stdin_text, expect_kind, expect_py, compare_mode, is_hidden FROM bh_puzzle_tests WHERE puzzle_id = :id ORDER BY sort_order');
    $testsStmt->execute(['id' => $p['id']]);
    $tests = array_map(static function (array $t): array {
        $t['hidden'] = (bool) $t['is_hidden'];
        unset($t['is_hidden']);
        return $t;
    }, $testsStmt->fetchAll());

    $hintsStmt = $pdo->prepare('SELECT tier, hint_md FROM bh_hints WHERE puzzle_id = :id ORDER BY tier');
    $hintsStmt->execute(['id' => $p['id']]);

    $bugsStmt = $pdo->prepare(
        'SELECT b.line_start, b.line_end, b.bug_type, c.slug AS concept, b.what_md, b.fix_md
         FROM bh_puzzle_bugs b LEFT JOIN bh_concepts c ON c.id = b.concept_id WHERE b.puzzle_id = :id ORDER BY b.sort_order',
    );
    $bugsStmt->execute(['id' => $p['id']]);

    $conceptsStmt = $pdo->prepare('SELECT c.slug FROM bh_puzzle_concepts pc JOIN bh_concepts c ON c.id = pc.concept_id WHERE pc.puzzle_id = :id');
    $conceptsStmt->execute(['id' => $p['id']]);

    $puzzles[] = [
        'slug' => $p['slug'],
        'track' => $trackSlugById[$p['track_id']] ?? null,
        'title' => $p['title'],
        'difficulty' => (int) $p['difficulty'],
        'xp' => $p['xp'] !== null ? (int) $p['xp'] : null,
        'bug_type' => $p['bug_type'],
        'entry_mode' => $p['entry_mode'],
        'entry_name' => $p['entry_name'],
        'brief_md' => $p['brief_md'],
        'buggy_code' => $p['buggy_code'],
        'fixed_code' => $p['fixed_code'],
        'predict_prompt_md' => $p['predict_prompt_md'],
        'status' => $p['status'],
        'tests' => $tests,
        'hints' => $hintsStmt->fetchAll(),
        'bugs' => $bugsStmt->fetchAll(),
        'concepts' => array_column($conceptsStmt->fetchAll(), 'slug'),
        'explanation_md' => $p['explanation_md'],
        'spot_it_md' => $p['spot_it_md'],
    ];
}

// Unlike every other endpoint, this returns the bundle directly (no
// {ok, data} envelope) - it's a file download meant to be re-uploaded
// as-is to import.php, or shared with another teacher, not parsed as a
// typical API response.
header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="bughunt-export.json"');
echo json_encode(['tracks' => $tracks, 'concepts' => $concepts, 'puzzles' => $puzzles], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
