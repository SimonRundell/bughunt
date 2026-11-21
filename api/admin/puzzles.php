<?php
/**
 * GET -> every puzzle (including drafts), for the admin list view.
 * POST -> create a new (draft, unverified) puzzle; full editing of its
 * tests/hints/bugs/concepts happens via PUT puzzle.php?id= afterwards.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

bh_require_admin();
$pdo = bh_db();
$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    $stmt = $pdo->query(
        "SELECT p.id, p.slug, p.title, t.slug AS track, p.difficulty, p.bug_type, p.status,
                (p.verified_hash IS NOT NULL) AS verified
         FROM bh_puzzles p
         JOIN bh_tracks t ON t.id = p.track_id
         ORDER BY t.sort_order, p.sort_order",
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['verified'] = (bool) $row['verified'];
    }
    bh_ok($rows);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $slug = trim((string) ($body['slug'] ?? ''));
    $trackSlug = (string) ($body['track'] ?? '');
    $title = trim((string) ($body['title'] ?? ''));
    $difficulty = (int) ($body['difficulty'] ?? 1);
    $bugType = in_array($body['bug_type'] ?? '', ['syntax', 'runtime', 'logic', 'mixed'], true) ? $body['bug_type'] : 'logic';
    $entryMode = ($body['entry_mode'] ?? '') === 'script' ? 'script' : 'function';

    if ($slug === '' || !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug)) {
        bh_error('invalid_slug', 'Slug must be lowercase letters, numbers and hyphens only.', 422);
    }
    if ($title === '') {
        bh_error('invalid_title', 'Title is required.', 422);
    }
    if ($difficulty < 1 || $difficulty > 5) {
        bh_error('invalid_difficulty', 'Difficulty must be 1-5.', 422);
    }

    $trackStmt = $pdo->prepare('SELECT id FROM bh_tracks WHERE slug = :slug');
    $trackStmt->execute(['slug' => $trackSlug]);
    $trackId = $trackStmt->fetchColumn();
    if (!$trackId) {
        bh_error('invalid_track', 'Unknown track.', 422);
    }

    $existsStmt = $pdo->prepare('SELECT 1 FROM bh_puzzles WHERE slug = :slug');
    $existsStmt->execute(['slug' => $slug]);
    if ($existsStmt->fetch()) {
        bh_error('slug_taken', 'A puzzle with that slug already exists.', 409);
    }

    $me = bh_current_admin();
    $pdo->prepare(
        'INSERT INTO bh_puzzles (slug, track_id, title, difficulty, bug_type, brief_md, buggy_code, fixed_code, entry_mode, entry_name, explanation_md, status, created_by)
         VALUES (:slug, :track_id, :title, :difficulty, :bug_type, :brief, :buggy, :fixed, :entry_mode, :entry_name, :explanation, :status, :created_by)',
    )->execute([
        'slug' => $slug,
        'track_id' => $trackId,
        'title' => $title,
        'difficulty' => $difficulty,
        'bug_type' => $bugType,
        'brief' => (string) ($body['brief_md'] ?? ''),
        'buggy' => (string) ($body['buggy_code'] ?? ''),
        'fixed' => (string) ($body['fixed_code'] ?? ''),
        'entry_mode' => $entryMode,
        'entry_name' => $entryMode === 'function' ? (string) ($body['entry_name'] ?? '') : null,
        'explanation' => (string) ($body['explanation_md'] ?? ''),
        'status' => 'draft',
        'created_by' => $me['id'],
    ]);

    bh_ok(['id' => (int) $pdo->lastInsertId(), 'slug' => $slug], 201);
}

bh_error('method_not_allowed', 'Use GET or POST.', 405);
