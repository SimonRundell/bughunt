<?php
/**
 * GET ?slug=&tier=1|2|3 -> that one hint's markdown. Fetched only when the
 * student actually reveals it, so earlier tiers aren't sent speculatively.
 */
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib/response.php';

$slug = $_GET['slug'] ?? '';
$tier = (int) ($_GET['tier'] ?? 0);

if (!is_string($slug) || $slug === '' || $tier < 1 || $tier > 3) {
    bh_error('invalid_params', 'Provide a ?slug= and a ?tier= of 1, 2 or 3.', 422);
}

$pdo = bh_db();
$stmt = $pdo->prepare(
    "SELECT h.hint_md
     FROM bh_hints h
     JOIN bh_puzzles p ON p.id = h.puzzle_id
     WHERE p.slug = :slug AND p.status = 'published' AND h.tier = :tier",
);
$stmt->execute(['slug' => $slug, 'tier' => $tier]);
$hintMd = $stmt->fetchColumn();

if ($hintMd === false) {
    bh_error('not_found', 'No hint at that tier for this puzzle.', 404);
}

bh_ok(['hint_md' => $hintMd]);
