<?php
/**
 * Shared CORS handling. Include first in every endpoint.
 * Reflects the Origin header back only for localhost on any port.
 */
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$isLocalhostOrigin = $origin !== '' && preg_match('#^https?://localhost(:\d+)?$#', $origin);
if ($isLocalhostOrigin) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    // Dev only: the frontend dev server sets Cross-Origin-Embedder-Policy:
    // require-corp (needed for SharedArrayBuffer), which otherwise blocks
    // these cross-origin API responses from being used as subresources.
    header('Cross-Origin-Resource-Policy: cross-origin');
}
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Authorization, Content-Type');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit();
}
