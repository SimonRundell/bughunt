<?php
/**
 * Loads .config.json from the project root. Never committed; see
 * .config.example.json for the shape.
 */

/**
 * @return array{db: array, app: array, auth: array}
 */
function bh_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $path = __DIR__ . '/../.config.json';
    if (!is_file($path)) {
        throw new RuntimeException('.config.json not found. Copy .config.example.json and fill it in.');
    }

    $json = file_get_contents($path);
    $decoded = json_decode($json, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('.config.json is not valid JSON.');
    }

    $config = $decoded;
    return $config;
}
