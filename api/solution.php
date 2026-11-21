<?php
/**
 * GET ?slug= -> fixed code, bugs (line ranges, descriptions), explanation,
 * spot-it text. Fetched only once a puzzle is solved or given up on
 * (BUILD.md 5.3) - the frontend controls when this is called, not this
 * endpoint, since it's a soft control rather than real security.
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
    "SELECT id, fixed_code, explanation_md, spot_it_md
     FROM bh_puzzles WHERE slug = :slug AND status = 'published'",
);
$stmt->execute(['slug' => $slug]);
$puzzle = $stmt->fetch();

if (!$puzzle) {
    bh_error('not_found', 'No published puzzle with that slug.', 404);
}

$bugsStmt = $pdo->prepare(
    'SELECT b.line_start, b.line_end, b.bug_type, c.slug AS concept, b.what_md, b.fix_md
     FROM bh_puzzle_bugs b
     LEFT JOIN bh_concepts c ON c.id = b.concept_id
     WHERE b.puzzle_id = :id ORDER BY b.sort_order',
);
$bugsStmt->execute(['id' => $puzzle['id']]);

bh_ok([
    'fixed_code' => $puzzle['fixed_code'],
    'explanation_md' => $puzzle['explanation_md'],
    'spot_it_md' => $puzzle['spot_it_md'],
    'bugs' => $bugsStmt->fetchAll(),
]);
