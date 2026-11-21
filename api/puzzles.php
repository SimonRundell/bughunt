<?php
/**
 * GET ?track=slug -> published puzzles in that track: slug, title,
 * difficulty, bug_type, xp. No code, tests or hints (that's puzzle.php).
 */
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib/response.php';

$trackSlug = $_GET['track'] ?? '';
if (!is_string($trackSlug) || $trackSlug === '') {
    bh_error('missing_track', 'Provide a ?track= slug.', 422);
}

$pdo = bh_db();
$stmt = $pdo->prepare(
    "SELECT p.slug, p.title, p.difficulty, p.bug_type, p.xp
     FROM bh_puzzles p
     JOIN bh_tracks t ON t.id = p.track_id
     WHERE t.slug = :track AND p.status = 'published'
     ORDER BY p.sort_order",
);
$stmt->execute(['track' => $trackSlug]);

bh_ok($stmt->fetchAll());
