<?php
/**
 * POST { username, password } -> { token, username, role }.
 * The raw token is returned exactly once and never stored - only its
 * SHA-256 hash lives in bh_admin_tokens (BUILD.md 5.2).
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    bh_error('method_not_allowed', 'Use POST.', 405);
}

bh_check_and_record_login_attempt();

$body = json_decode(file_get_contents('php://input'), true);
$username = is_array($body) ? ($body['username'] ?? '') : '';
$password = is_array($body) ? ($body['password'] ?? '') : '';

if (!is_string($username) || !is_string($password) || $username === '' || $password === '') {
    bh_error('invalid_credentials', 'Enter a username and password.', 401);
}

$pdo = bh_db();
$stmt = $pdo->prepare('SELECT id, username, password_hash, role FROM bh_admins WHERE username = :username');
$stmt->execute(['username' => $username]);
$admin = $stmt->fetch();

if (!$admin || !password_verify($password, $admin['password_hash'])) {
    // Same generic message either way - don't reveal which part was wrong.
    bh_error('invalid_credentials', 'Invalid username or password.', 401);
}

$rawToken = bh_generate_token();
$ttlHours = (int) (bh_config()['auth']['tokenTtlHours'] ?? 8);

$pdo->prepare('INSERT INTO bh_admin_tokens (admin_id, token_hash, expires_at) VALUES (:admin_id, :hash, NOW() + INTERVAL :ttl HOUR)')
    ->execute(['admin_id' => $admin['id'], 'hash' => bh_hash_token($rawToken), 'ttl' => $ttlHours]);

$pdo->prepare('UPDATE bh_admins SET last_login_at = NOW() WHERE id = :id')->execute(['id' => $admin['id']]);

bh_ok([
    'token' => $rawToken,
    'username' => $admin['username'],
    'role' => $admin['role'],
]);
