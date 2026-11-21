<?php
/**
 * GET ?id= -> full puzzle detail for the editor, including fixed_code,
 * tests, hints, bugs and concepts (unlike the public puzzle.php).
 * PUT ?id= -> replace everything about a puzzle (child rows are deleted
 * and re-inserted from the payload - simplest robust approach at this
 * scale). Publishing is rejected unless the content hash already matches
 * a stored verification (BUILD.md 8); any edit that changes
 * buggy_code/fixed_code/tests/entry settings invalidates that
 * verification automatically.
 * DELETE ?id= -> removes the puzzle and all its child rows (cascades).
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/puzzle_hash.php';

bh_require_admin();
$pdo = bh_db();
$method = $_SERVER['REQUEST_METHOD'] ?? '';
$id = (int) ($_GET['id'] ?? 0);

if ($id <= 0) {
    bh_error('invalid_id', 'Provide a valid ?id=.', 422);
}

if ($method === 'GET') {
    $stmt = $pdo->prepare(
        'SELECT p.*, t.slug AS track_slug FROM bh_puzzles p JOIN bh_tracks t ON t.id = p.track_id WHERE p.id = :id',
    );
    $stmt->execute(['id' => $id]);
    $puzzle = $stmt->fetch();
    if (!$puzzle) {
        bh_error('not_found', 'No puzzle with that id.', 404);
    }

    $testsStmt = $pdo->prepare('SELECT * FROM bh_puzzle_tests WHERE puzzle_id = :id ORDER BY sort_order');
    $testsStmt->execute(['id' => $id]);
    $hintsStmt = $pdo->prepare('SELECT tier, hint_md FROM bh_hints WHERE puzzle_id = :id ORDER BY tier');
    $hintsStmt->execute(['id' => $id]);
    $bugsStmt = $pdo->prepare(
        'SELECT b.line_start, b.line_end, b.bug_type, c.slug AS concept, b.what_md, b.fix_md
         FROM bh_puzzle_bugs b LEFT JOIN bh_concepts c ON c.id = b.concept_id
         WHERE b.puzzle_id = :id ORDER BY b.sort_order',
    );
    $bugsStmt->execute(['id' => $id]);
    $conceptsStmt = $pdo->prepare(
        'SELECT c.slug FROM bh_puzzle_concepts pc JOIN bh_concepts c ON c.id = pc.concept_id WHERE pc.puzzle_id = :id',
    );
    $conceptsStmt->execute(['id' => $id]);

    $puzzle['verified'] = $puzzle['verified_hash'] !== null;
    $puzzle['tests'] = $testsStmt->fetchAll();
    $puzzle['hints'] = $hintsStmt->fetchAll();
    $puzzle['bugs'] = $bugsStmt->fetchAll();
    $puzzle['concepts'] = array_column($conceptsStmt->fetchAll(), 'slug');
    bh_ok($puzzle);
}

if ($method === 'PUT') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];

    $existsStmt = $pdo->prepare('SELECT verified_hash, verified_at FROM bh_puzzles WHERE id = :id');
    $existsStmt->execute(['id' => $id]);
    $existing = $existsStmt->fetch();
    if (!$existing) {
        bh_error('not_found', 'No puzzle with that id.', 404);
    }

    $trackSlug = (string) ($body['track'] ?? '');
    $trackStmt = $pdo->prepare('SELECT id FROM bh_tracks WHERE slug = :slug');
    $trackStmt->execute(['slug' => $trackSlug]);
    $trackId = $trackStmt->fetchColumn();
    if (!$trackId) {
        bh_error('invalid_track', 'Unknown track.', 422);
    }

    $tests = is_array($body['tests'] ?? null) ? $body['tests'] : [];
    $hints = is_array($body['hints'] ?? null) ? $body['hints'] : [];
    $bugs = is_array($body['bugs'] ?? null) ? $body['bugs'] : [];
    $conceptSlugs = is_array($body['concepts'] ?? null) ? $body['concepts'] : [];
    $entryMode = ($body['entry_mode'] ?? '') === 'script' ? 'script' : 'function';

    $newHash = bh_puzzle_verification_hash([
        'buggy_code' => (string) ($body['buggy_code'] ?? ''),
        'fixed_code' => (string) ($body['fixed_code'] ?? ''),
        'entry_mode' => $entryMode,
        'entry_name' => $entryMode === 'function' ? (string) ($body['entry_name'] ?? '') : null,
    ], $tests);

    $stillVerified = $existing['verified_hash'] !== null && hash_equals($existing['verified_hash'], $newHash);
    $requestedStatus = ($body['status'] ?? 'draft') === 'published' ? 'published' : 'draft';

    if ($requestedStatus === 'published' && !$stillVerified) {
        bh_error('not_verified', "This puzzle can't be published until it's verified - run Verify first.", 422);
    }

    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'UPDATE bh_puzzles SET track_id = :track_id, title = :title, difficulty = :difficulty, xp = :xp, bug_type = :bug_type,
                brief_md = :brief, buggy_code = :buggy, fixed_code = :fixed, entry_mode = :entry_mode, entry_name = :entry_name,
                explanation_md = :explanation, spot_it_md = :spot_it, predict_prompt_md = :predict, status = :status,
                verified_hash = :verified_hash, verified_at = :verified_at
             WHERE id = :id',
        )->execute([
            'track_id' => $trackId,
            'title' => trim((string) ($body['title'] ?? '')),
            'difficulty' => max(1, min(5, (int) ($body['difficulty'] ?? 1))),
            'xp' => isset($body['xp']) && $body['xp'] !== '' && $body['xp'] !== null ? (int) $body['xp'] : null,
            'bug_type' => in_array($body['bug_type'] ?? '', ['syntax', 'runtime', 'logic', 'mixed'], true) ? $body['bug_type'] : 'logic',
            'brief' => (string) ($body['brief_md'] ?? ''),
            'buggy' => (string) ($body['buggy_code'] ?? ''),
            'fixed' => (string) ($body['fixed_code'] ?? ''),
            'entry_mode' => $entryMode,
            'entry_name' => $entryMode === 'function' ? (string) ($body['entry_name'] ?? '') : null,
            'explanation' => (string) ($body['explanation_md'] ?? ''),
            'spot_it' => $body['spot_it_md'] ?? null,
            'predict' => $body['predict_prompt_md'] ?? null,
            'status' => $requestedStatus,
            'verified_hash' => $stillVerified ? $existing['verified_hash'] : null,
            'verified_at' => $stillVerified ? $existing['verified_at'] : null,
            'id' => $id,
        ]);

        $pdo->prepare('DELETE FROM bh_puzzle_tests WHERE puzzle_id = :id')->execute(['id' => $id]);
        $testInsert = $pdo->prepare(
            'INSERT INTO bh_puzzle_tests (puzzle_id, sort_order, label, args_py, kwargs_py, stdin_text, expect_kind, expect_py, compare_mode, is_hidden)
             VALUES (:id, :sort, :label, :args, :kwargs, :stdin, :kind, :expect, :compare, :hidden)',
        );
        foreach ($tests as $i => $t) {
            $testInsert->execute([
                'id' => $id, 'sort' => $i + 1,
                'label' => (string) ($t['label'] ?? ''),
                'args' => $t['args_py'] ?? null, 'kwargs' => $t['kwargs_py'] ?? null, 'stdin' => $t['stdin_text'] ?? null,
                'kind' => (string) ($t['expect_kind'] ?? 'returns'), 'expect' => (string) ($t['expect_py'] ?? ''),
                'compare' => (string) ($t['compare_mode'] ?? 'exact'), 'hidden' => !empty($t['hidden']) ? 1 : 0,
            ]);
        }

        $pdo->prepare('DELETE FROM bh_hints WHERE puzzle_id = :id')->execute(['id' => $id]);
        $hintInsert = $pdo->prepare('INSERT INTO bh_hints (puzzle_id, tier, hint_md) VALUES (:id, :tier, :md)');
        foreach ($hints as $h) {
            if (($h['hint_md'] ?? '') === '') continue;
            $hintInsert->execute(['id' => $id, 'tier' => (int) ($h['tier'] ?? 0), 'md' => (string) $h['hint_md']]);
        }

        $pdo->prepare('DELETE FROM bh_puzzle_bugs WHERE puzzle_id = :id')->execute(['id' => $id]);
        $bugInsert = $pdo->prepare(
            'INSERT INTO bh_puzzle_bugs (puzzle_id, sort_order, line_start, line_end, bug_type, concept_id, what_md, fix_md)
             VALUES (:id, :sort, :start, :end, :bug_type, (SELECT id FROM bh_concepts WHERE slug = :concept), :what, :fix)',
        );
        foreach ($bugs as $i => $b) {
            $bugInsert->execute([
                'id' => $id, 'sort' => $i + 1,
                'start' => (int) ($b['line_start'] ?? 1), 'end' => (int) ($b['line_end'] ?? 1),
                'bug_type' => in_array($b['bug_type'] ?? '', ['syntax', 'runtime', 'logic'], true) ? $b['bug_type'] : 'logic',
                'concept' => $b['concept'] ?? '__none__',
                'what' => (string) ($b['what_md'] ?? ''), 'fix' => (string) ($b['fix_md'] ?? ''),
            ]);
        }

        $pdo->prepare('DELETE FROM bh_puzzle_concepts WHERE puzzle_id = :id')->execute(['id' => $id]);
        $conceptInsert = $pdo->prepare(
            'INSERT IGNORE INTO bh_puzzle_concepts (puzzle_id, concept_id) VALUES (:id, (SELECT id FROM bh_concepts WHERE slug = :slug))',
        );
        foreach ($conceptSlugs as $slug) {
            $conceptInsert->execute(['id' => $id, 'slug' => $slug]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        bh_error('update_failed', 'Could not save: ' . $e->getMessage(), 500);
    }

    bh_ok(['id' => $id, 'verified' => $stillVerified]);
}

if ($method === 'DELETE') {
    $pdo->prepare('DELETE FROM bh_puzzles WHERE id = :id')->execute(['id' => $id]);
    bh_ok(['deleted' => true]);
}

bh_error('method_not_allowed', 'Use GET, PUT or DELETE.', 405);
