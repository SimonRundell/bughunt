<?php
/**
 * GET -> all tracks (incl. drafts). POST -> create. PUT ?id= -> update.
 * DELETE ?id= -> remove (cascades to its puzzles - the UI should confirm
 * this clearly before calling it).
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

bh_require_admin();
$pdo = bh_db();
$method = $_SERVER['REQUEST_METHOD'] ?? '';

function bh_track_fields(array $body): array
{
    return [
        'slug' => trim((string) ($body['slug'] ?? '')),
        'title' => trim((string) ($body['title'] ?? '')),
        'summary' => (string) ($body['summary'] ?? ''),
        'intro_md' => $body['intro_md'] ?? null,
        'bug_focus' => in_array($body['bug_focus'] ?? '', ['syntax', 'runtime', 'logic', 'mixed'], true) ? $body['bug_focus'] : 'mixed',
        'assist_level' => in_array($body['assist_level'] ?? '', ['none', 'basic', 'full'], true) ? $body['assist_level'] : 'full',
        'sort_order' => (int) ($body['sort_order'] ?? 0),
        'status' => ($body['status'] ?? 'draft') === 'published' ? 'published' : 'draft',
    ];
}

if ($method === 'GET') {
    bh_ok($pdo->query('SELECT * FROM bh_tracks ORDER BY sort_order')->fetchAll());
}

if ($method === 'POST') {
    $f = bh_track_fields(json_decode(file_get_contents('php://input'), true) ?: []);
    if ($f['slug'] === '' || !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $f['slug']) || $f['title'] === '') {
        bh_error('invalid_fields', 'Slug (lowercase, hyphenated) and title are required.', 422);
    }
    $pdo->prepare(
        'INSERT INTO bh_tracks (slug, title, summary, intro_md, bug_focus, assist_level, sort_order, status)
         VALUES (:slug, :title, :summary, :intro_md, :bug_focus, :assist_level, :sort_order, :status)',
    )->execute($f);
    bh_ok(['id' => (int) $pdo->lastInsertId()], 201);
}

if ($method === 'PUT') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) bh_error('invalid_id', 'Provide a valid ?id=.', 422);
    $f = bh_track_fields(json_decode(file_get_contents('php://input'), true) ?: []);
    if ($f['title'] === '') {
        bh_error('invalid_fields', 'Title is required.', 422);
    }
    unset($f['slug']); // slug is immutable once created - not part of this update
    $pdo->prepare(
        'UPDATE bh_tracks SET title = :title, summary = :summary, intro_md = :intro_md, bug_focus = :bug_focus,
            assist_level = :assist_level, sort_order = :sort_order, status = :status WHERE id = :id',
    )->execute(array_merge($f, ['id' => $id]));
    bh_ok(['id' => $id]);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) bh_error('invalid_id', 'Provide a valid ?id=.', 422);
    $pdo->prepare('DELETE FROM bh_tracks WHERE id = :id')->execute(['id' => $id]);
    bh_ok(['deleted' => true]);
}

bh_error('method_not_allowed', 'Use GET, POST, PUT or DELETE.', 405);
