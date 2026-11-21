<?php
/**
 * GET -> published tracks, in order, each with its puzzle count.
 */
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib/response.php';

$pdo = bh_db();
$stmt = $pdo->query(
    "SELECT t.slug, t.title, t.summary, t.intro_md, t.bug_focus, t.assist_level, t.sort_order,
            (SELECT COUNT(*) FROM bh_puzzles p WHERE p.track_id = t.id AND p.status = 'published') AS puzzle_count
     FROM bh_tracks t
     WHERE t.status = 'published'
     ORDER BY t.sort_order",
);

bh_ok($stmt->fetchAll());
