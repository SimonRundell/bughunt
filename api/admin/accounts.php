<?php
/**
 * Admin-only account management (not in BUILD.md's original spec - added
 * for teacher/admin roles). GET lists every account; POST creates one;
 * DELETE removes one. All three require the 'admin' role specifically,
 * not just 'teacher' - an admin is also a teacher, but a teacher cannot
 * manage accounts.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

$me = bh_require_admin('admin');
$pdo = bh_db();
$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    $stmt = $pdo->query('SELECT id, username, role, created_at, last_login_at FROM bh_admins ORDER BY username');
    bh_ok($stmt->fetchAll());
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $username = is_array($body) ? trim((string) ($body['username'] ?? '')) : '';
    $password = is_array($body) ? (string) ($body['password'] ?? '') : '';
    $role = is_array($body) && ($body['role'] ?? '') === 'admin' ? 'admin' : 'teacher';

    if ($username === '' || strlen($username) > 64) {
        bh_error('invalid_username', 'Username is required (max 64 characters).', 422);
    }
    if (strlen($password) < 8) {
        bh_error('invalid_password', 'Password must be at least 8 characters.', 422);
    }

    $exists = $pdo->prepare('SELECT 1 FROM bh_admins WHERE username = :u');
    $exists->execute(['u' => $username]);
    if ($exists->fetch()) {
        bh_error('username_taken', 'That username is already in use.', 409);
    }

    $hash = password_hash($password, PASSWORD_ARGON2ID);
    $pdo->prepare('INSERT INTO bh_admins (username, password_hash, role, created_by) VALUES (:u, :h, :r, :by)')
        ->execute(['u' => $username, 'h' => $hash, 'r' => $role, 'by' => $me['id']]);

    bh_ok(['id' => (int) $pdo->lastInsertId(), 'username' => $username, 'role' => $role], 201);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        bh_error('invalid_id', 'Missing or invalid id.', 422);
    }
    if ($id === $me['id']) {
        bh_error('cannot_delete_self', "You can't delete your own account while logged in as it.", 400);
    }
    $pdo->prepare('DELETE FROM bh_admins WHERE id = :id')->execute(['id' => $id]);
    bh_ok(['deleted' => true]);
}

bh_error('method_not_allowed', 'Use GET, POST or DELETE.', 405);
