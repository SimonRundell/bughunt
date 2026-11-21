<?php
/**
 * PDO connection, built from .config.json. MySQL/MariaDB, utf8mb4.
 */
require_once __DIR__ . '/config.php';

/**
 * @return PDO
 */
function bh_db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $db = bh_config()['db'];
    $host = $db['host'];
    $port = $db['port'] ?? 3306;
    $name = $db['name'];

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}
