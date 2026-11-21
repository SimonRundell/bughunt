<?php
/**
 * POST { current_password, new_password } -> changes the caller's own
 * password. Any logged-in account (teacher or admin) can use this on
 * itself - unlike accounts.php, this needs no 'admin' role since it only
 * ever touches the caller's own row.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

$me = bh_require_admin('teacher');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    bh_error('method_not_allowed', 'Use POST.', 405);
}

$body = json_decode(file_get_contents('php://input'), true);
$currentPassword = is_array($body) ? (string) ($body['current_password'] ?? '') : '';
$newPassword = is_array($body) ? (string) ($body['new_password'] ?? '') : '';

if (strlen($newPassword) < 8) {
    bh_error('invalid_password', 'New password must be at least 8 characters.', 422);
}

$pdo = bh_db();
$stmt = $pdo->prepare('SELECT password_hash FROM bh_admins WHERE id = :id');
$stmt->execute(['id' => $me['id']]);
$row = $stmt->fetch();

if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
    bh_error('invalid_credentials', 'Current password is incorrect.', 401);
}

$hash = password_hash($newPassword, PASSWORD_ARGON2ID);
$pdo->prepare('UPDATE bh_admins SET password_hash = :h WHERE id = :id')->execute(['h' => $hash, 'id' => $me['id']]);

bh_ok(['changed' => true]);
