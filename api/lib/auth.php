<?php
/**
 * Opaque bearer-token auth (BUILD.md 5.2): random_bytes(32) tokens, only
 * their SHA-256 hash stored, with an expiry. Two roles - 'admin' and
 * 'teacher' - where 'admin' is a superset (an admin passes any
 * teacher-level check too) and can additionally manage accounts.
 */
require_once __DIR__ . '/response.php';

/** @return string a new raw token (64 hex chars), never stored directly */
function bh_generate_token(): string
{
    return bin2hex(random_bytes(32));
}

/** @param string $rawToken @return string SHA-256 hex hash, what's actually stored */
function bh_hash_token(string $rawToken): string
{
    return hash('sha256', $rawToken);
}

/** @return string|null the raw bearer token from the Authorization header, or null */
function bh_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+(.+)$/i', $header, $matches)) {
        return trim($matches[1]);
    }
    return null;
}

/**
 * Validates the bearer token against bh_admin_tokens (checking expiry) and
 * returns the admin row, or null if missing/invalid/expired. Does not
 * exit - callers that need to reject invalid requests should use
 * bh_require_admin() instead.
 *
 * @return array{id: int, username: string, role: string}|null
 */
function bh_current_admin(): ?array
{
    $token = bh_bearer_token();
    if ($token === null || $token === '') {
        return null;
    }

    $pdo = bh_db();
    $stmt = $pdo->prepare(
        'SELECT a.id, a.username, a.role
         FROM bh_admin_tokens t
         JOIN bh_admins a ON a.id = t.admin_id
         WHERE t.token_hash = :hash AND t.expires_at > NOW()',
    );
    $stmt->execute(['hash' => bh_hash_token($token)]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/**
 * Requires a valid bearer token, ending the request with 401 if missing or
 * invalid. Pass 'admin' to additionally require the admin role (not just
 * teacher) - e.g. for account management endpoints.
 *
 * @param 'teacher'|'admin' $minRole
 * @return array{id: int, username: string, role: string}
 */
function bh_require_admin(string $minRole = 'teacher'): array
{
    $admin = bh_current_admin();
    if ($admin === null) {
        bh_error('unauthorized', 'Log in again - your session is missing or has expired.', 401);
    }
    if ($minRole === 'admin' && $admin['role'] !== 'admin') {
        bh_error('forbidden', 'Only an admin account can do this.', 403);
    }
    return $admin;
}

/**
 * Login rate limiting by IP (BUILD.md 5.2). Records this attempt, then
 * checks whether the IP has exceeded the configured limit within the last
 * 15 minutes.
 */
function bh_check_and_record_login_attempt(): void
{
    $pdo = bh_db();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $maxAttempts = bh_config()['auth']['maxLoginAttemptsPer15Min'] ?? 8;

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM bh_login_attempts WHERE ip = :ip AND attempted_at > (NOW() - INTERVAL 15 MINUTE)');
    $stmt->execute(['ip' => $ip]);
    $recentAttempts = (int) $stmt->fetchColumn();

    if ($recentAttempts >= $maxAttempts) {
        bh_error('too_many_attempts', 'Too many login attempts. Wait 15 minutes and try again.', 429);
    }

    $pdo->prepare('INSERT INTO bh_login_attempts (ip) VALUES (:ip)')->execute(['ip' => $ip]);
}
