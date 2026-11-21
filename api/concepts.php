<?php
/**
 * GET -> every concept card's list view (slug, title, summary).
 */
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib/response.php';

$stmt = bh_db()->query('SELECT slug, title, summary FROM bh_concepts ORDER BY title');
bh_ok($stmt->fetchAll());
