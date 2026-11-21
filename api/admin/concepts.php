<?php
/**
 * GET -> all concepts. POST -> create. PUT ?id= -> update. DELETE ?id=.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

bh_require_admin();
$pdo = bh_db();
$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    bh_ok($pdo->query('SELECT * FROM bh_concepts ORDER BY title')->fetchAll());
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $slug = trim((string) ($body['slug'] ?? ''));
    $title = trim((string) ($body['title'] ?? ''));
    if ($slug === '' || !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $slug) || $title === '') {
        bh_error('invalid_fields', 'Slug (lowercase, hyphenated) and title are required.', 422);
    }
    $exists = $pdo->prepare('SELECT 1 FROM bh_concepts WHERE slug = :slug');
    $exists->execute(['slug' => $slug]);
    if ($exists->fetch()) {
        bh_error('slug_taken', 'A concept with that slug already exists.', 409);
    }
    $pdo->prepare('INSERT INTO bh_concepts (slug, title, summary, lesson_md) VALUES (:slug, :title, :summary, :lesson)')
        ->execute(['slug' => $slug, 'title' => $title, 'summary' => (string) ($body['summary'] ?? ''), 'lesson' => (string) ($body['lesson_md'] ?? '')]);
    bh_ok(['id' => (int) $pdo->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) bh_error('invalid_id', 'Provide a valid ?id=.', 422);
    $body = json_decode(file_get_contents('php://input'), true) ?: [];
    $title = trim((string) ($body['title'] ?? ''));
    if ($title === '') {
        bh_error('invalid_fields', 'Title is required.', 422);
    }
    $pdo->prepare('UPDATE bh_concepts SET title = :title, summary = :summary, lesson_md = :lesson WHERE id = :id')
        ->execute(['title' => $title, 'summary' => (string) ($body['summary'] ?? ''), 'lesson' => (string) ($body['lesson_md'] ?? ''), 'id' => $id]);
    bh_ok(['id' => $id]);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) bh_error('invalid_id', 'Provide a valid ?id=.', 422);
    $pdo->prepare('DELETE FROM bh_concepts WHERE id = :id')->execute(['id' => $id]);
    bh_ok(['deleted' => true]);
}

bh_error('method_not_allowed', 'Use GET, POST, PUT or DELETE.', 405);
