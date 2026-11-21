<?php
/**
 * POST a content bundle (same shape as export.php) -> validates, then
 * upserts tracks, concepts and puzzles by slug. Imported puzzles always
 * land as unverified drafts (BUILD.md: editing/importing content clears
 * verification) regardless of what status the bundle claims, so nothing
 * goes live without a teacher reviewing and verifying it here first.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

bh_require_admin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    bh_error('method_not_allowed', 'Use POST.', 405);
}

$maxBytes = 2 * 1024 * 1024; // 2MB JSON size cap (BUILD.md 11)
$raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
if (strlen($raw) > $maxBytes) {
    bh_error('too_large', 'Import file is too large (max 2MB).', 413);
}

$bundle = json_decode($raw, true);
if (!is_array($bundle) || !isset($bundle['tracks'], $bundle['concepts'], $bundle['puzzles'])) {
    bh_error('invalid_bundle', 'Expected a bundle with tracks, concepts and puzzles arrays.', 422);
}

$pdo = bh_db();
$summary = ['tracks' => 0, 'concepts' => 0, 'puzzles' => 0];

$pdo->beginTransaction();
try {
    foreach ($bundle['tracks'] as $t) {
        $slug = trim((string) ($t['slug'] ?? ''));
        if ($slug === '' || !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug)) {
            throw new RuntimeException("Track has an invalid slug: " . json_encode($t['slug'] ?? null));
        }
        $pdo->prepare(
            'INSERT INTO bh_tracks (slug, title, summary, intro_md, bug_focus, assist_level, sort_order, status)
             VALUES (:slug, :title, :summary, :intro, :focus, :assist, :sort, :status)
             ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), intro_md = VALUES(intro_md),
                bug_focus = VALUES(bug_focus), assist_level = VALUES(assist_level), sort_order = VALUES(sort_order)',
        )->execute([
            'slug' => $slug, 'title' => (string) ($t['title'] ?? $slug), 'summary' => (string) ($t['summary'] ?? ''),
            'intro' => $t['intro_md'] ?? null,
            'focus' => in_array($t['bug_focus'] ?? '', ['syntax', 'runtime', 'logic', 'mixed'], true) ? $t['bug_focus'] : 'mixed',
            'assist' => in_array($t['assist_level'] ?? '', ['none', 'basic', 'full'], true) ? $t['assist_level'] : 'full',
            'sort' => (int) ($t['sort_order'] ?? 0),
            'status' => 'draft', // imported tracks start as drafts too, same review principle
        ]);
        $summary['tracks']++;
    }

    foreach ($bundle['concepts'] as $c) {
        $slug = trim((string) ($c['slug'] ?? ''));
        if ($slug === '' || !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug)) {
            throw new RuntimeException("Concept has an invalid slug: " . json_encode($c['slug'] ?? null));
        }
        $pdo->prepare(
            'INSERT INTO bh_concepts (slug, title, summary, lesson_md) VALUES (:slug, :title, :summary, :lesson)
             ON DUPLICATE KEY UPDATE title = VALUES(title), summary = VALUES(summary), lesson_md = VALUES(lesson_md)',
        )->execute(['slug' => $slug, 'title' => (string) ($c['title'] ?? $slug), 'summary' => (string) ($c['summary'] ?? ''), 'lesson' => (string) ($c['lesson_md'] ?? '')]);
        $summary['concepts']++;
    }

    foreach ($bundle['puzzles'] as $p) {
        $slug = trim((string) ($p['slug'] ?? ''));
        if ($slug === '' || !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug)) {
            throw new RuntimeException("Puzzle has an invalid slug: " . json_encode($p['slug'] ?? null));
        }
        if (!is_array($p['tests'] ?? null) || count($p['tests']) === 0) {
            throw new RuntimeException("Puzzle '{$slug}' needs at least one test.");
        }
        $trackStmt = $pdo->prepare('SELECT id FROM bh_tracks WHERE slug = :slug');
        $trackStmt->execute(['slug' => (string) ($p['track'] ?? '')]);
        $trackId = $trackStmt->fetchColumn();
        if (!$trackId) {
            throw new RuntimeException("Puzzle '{$slug}' references an unknown track '" . ($p['track'] ?? '') . "'.");
        }

        $entryMode = ($p['entry_mode'] ?? '') === 'script' ? 'script' : 'function';
        $pdo->prepare(
            'INSERT INTO bh_puzzles (slug, track_id, title, difficulty, xp, bug_type, brief_md, buggy_code, fixed_code, entry_mode, entry_name, explanation_md, spot_it_md, predict_prompt_md, status)
             VALUES (:slug, :track_id, :title, :difficulty, :xp, :bug_type, :brief, :buggy, :fixed, :entry_mode, :entry_name, :explanation, :spot_it, :predict, :status)
             ON DUPLICATE KEY UPDATE track_id = VALUES(track_id), title = VALUES(title), difficulty = VALUES(difficulty),
                xp = VALUES(xp), bug_type = VALUES(bug_type), brief_md = VALUES(brief_md), buggy_code = VALUES(buggy_code),
                fixed_code = VALUES(fixed_code), entry_mode = VALUES(entry_mode), entry_name = VALUES(entry_name),
                explanation_md = VALUES(explanation_md), spot_it_md = VALUES(spot_it_md), predict_prompt_md = VALUES(predict_prompt_md),
                status = VALUES(status), verified_hash = NULL, verified_at = NULL',
        )->execute([
            'slug' => $slug, 'track_id' => $trackId, 'title' => (string) ($p['title'] ?? $slug),
            'difficulty' => max(1, min(5, (int) ($p['difficulty'] ?? 1))),
            'xp' => isset($p['xp']) && $p['xp'] !== null ? (int) $p['xp'] : null,
            'bug_type' => in_array($p['bug_type'] ?? '', ['syntax', 'runtime', 'logic', 'mixed'], true) ? $p['bug_type'] : 'logic',
            'brief' => (string) ($p['brief_md'] ?? ''), 'buggy' => (string) ($p['buggy_code'] ?? ''), 'fixed' => (string) ($p['fixed_code'] ?? ''),
            'entry_mode' => $entryMode, 'entry_name' => $entryMode === 'function' ? ($p['entry_name'] ?? null) : null,
            'explanation' => (string) ($p['explanation_md'] ?? ''), 'spot_it' => $p['spot_it_md'] ?? null, 'predict' => $p['predict_prompt_md'] ?? null,
            'status' => 'draft', // imported puzzles always start as unverified drafts
        ]);

        $idStmt = $pdo->prepare('SELECT id FROM bh_puzzles WHERE slug = :slug');
        $idStmt->execute(['slug' => $slug]);
        $puzzleId = $idStmt->fetchColumn();

        $pdo->prepare('DELETE FROM bh_puzzle_tests WHERE puzzle_id = :id')->execute(['id' => $puzzleId]);
        $testInsert = $pdo->prepare(
            'INSERT INTO bh_puzzle_tests (puzzle_id, sort_order, label, args_py, kwargs_py, stdin_text, expect_kind, expect_py, compare_mode, is_hidden)
             VALUES (:id, :sort, :label, :args, :kwargs, :stdin, :kind, :expect, :compare, :hidden)',
        );
        foreach ($p['tests'] as $i => $t) {
            $testInsert->execute([
                'id' => $puzzleId, 'sort' => $i + 1, 'label' => (string) ($t['label'] ?? ''),
                'args' => $t['args_py'] ?? null, 'kwargs' => $t['kwargs_py'] ?? null, 'stdin' => $t['stdin_text'] ?? null,
                'kind' => (string) ($t['expect_kind'] ?? 'returns'), 'expect' => (string) ($t['expect_py'] ?? ''),
                'compare' => (string) ($t['compare_mode'] ?? 'exact'), 'hidden' => !empty($t['hidden']) ? 1 : 0,
            ]);
        }

        $pdo->prepare('DELETE FROM bh_hints WHERE puzzle_id = :id')->execute(['id' => $puzzleId]);
        $hintInsert = $pdo->prepare('INSERT INTO bh_hints (puzzle_id, tier, hint_md) VALUES (:id, :tier, :md)');
        foreach (($p['hints'] ?? []) as $h) {
            if (($h['hint_md'] ?? '') === '') continue;
            $hintInsert->execute(['id' => $puzzleId, 'tier' => (int) ($h['tier'] ?? 0), 'md' => (string) $h['hint_md']]);
        }

        $pdo->prepare('DELETE FROM bh_puzzle_bugs WHERE puzzle_id = :id')->execute(['id' => $puzzleId]);
        $bugInsert = $pdo->prepare(
            'INSERT INTO bh_puzzle_bugs (puzzle_id, sort_order, line_start, line_end, bug_type, concept_id, what_md, fix_md)
             VALUES (:id, :sort, :start, :end, :bug_type, (SELECT id FROM bh_concepts WHERE slug = :concept), :what, :fix)',
        );
        foreach (($p['bugs'] ?? []) as $i => $b) {
            $bugInsert->execute([
                'id' => $puzzleId, 'sort' => $i + 1, 'start' => (int) ($b['line_start'] ?? 1), 'end' => (int) ($b['line_end'] ?? 1),
                'bug_type' => in_array($b['bug_type'] ?? '', ['syntax', 'runtime', 'logic'], true) ? $b['bug_type'] : 'logic',
                'concept' => $b['concept'] ?? '__none__', 'what' => (string) ($b['what_md'] ?? ''), 'fix' => (string) ($b['fix_md'] ?? ''),
            ]);
        }

        $pdo->prepare('DELETE FROM bh_puzzle_concepts WHERE puzzle_id = :id')->execute(['id' => $puzzleId]);
        $conceptInsert = $pdo->prepare('INSERT IGNORE INTO bh_puzzle_concepts (puzzle_id, concept_id) VALUES (:id, (SELECT id FROM bh_concepts WHERE slug = :slug))');
        foreach (($p['concepts'] ?? []) as $conceptSlug) {
            $conceptInsert->execute(['id' => $puzzleId, 'slug' => $conceptSlug]);
        }

        $summary['puzzles']++;
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    bh_error('import_failed', $e->getMessage(), 422);
}

bh_ok($summary);
