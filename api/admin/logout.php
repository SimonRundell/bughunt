<?php
/**
 * POST, bearer token required -> revokes that one token.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    bh_error('method_not_allowed', 'Use POST.', 405);
}

bh_require_admin();

$token = bh_bearer_token();
bh_db()->prepare('DELETE FROM bh_admin_tokens WHERE token_hash = :hash')
    ->execute(['hash' => bh_hash_token($token)]);

bh_ok(['loggedOut' => true]);
