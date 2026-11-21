<?php
/**
 * Returns only the safe, public subset of .config.json (the "app" block).
 * Secrets (db, auth) never leave the server.
 */
require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/lib/response.php';

bh_ok(bh_config()['app']);
