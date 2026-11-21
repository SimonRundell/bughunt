<?php
/**
 * GET, bearer token required -> { username, role }. Used by the admin app
 * on load to check whether the stored session token is still valid.
 */
require_once __DIR__ . '/../cors.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

$admin = bh_require_admin();

bh_ok([
    'username' => $admin['username'],
    'role' => $admin['role'],
]);
