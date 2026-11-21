<?php
/**
 * GET ?slug= -> one concept's full lesson.
 */
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib/response.php';

$slug = $_GET['slug'] ?? '';
if (!is_string($slug) || $slug === '') {
    bh_error('missing_slug', 'Provide a ?slug=.', 422);
}

$stmt = bh_db()->prepare('SELECT slug, title, summary, lesson_md FROM bh_concepts WHERE slug = :slug');
$stmt->execute(['slug' => $slug]);
$concept = $stmt->fetch();

if (!$concept) {
    bh_error('not_found', 'No concept with that slug.', 404);
}

bh_ok($concept);
