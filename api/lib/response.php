<?php
/**
 * Standard response envelope: { ok: true, data } or { ok: false, error }.
 */

/**
 * @param mixed $data
 */
function bh_ok($data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode(['ok' => true, 'data' => $data]);
    exit();
}

function bh_error(string $code, string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => ['code' => $code, 'message' => $message]]);
    exit();
}
