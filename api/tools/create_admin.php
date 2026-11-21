<?php
/**
 * CLI-only bootstrap tool: creates an admin or teacher account. Refuses to
 * run under a web server. Usage: `php api/tools/create_admin.php`.
 */
if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    echo "This tool can only be run from the command line.\n";
    exit(1);
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

function prompt(string $label): string
{
    echo $label;
    $line = fgets(STDIN);
    return $line === false ? '' : trim($line);
}

function promptPassword(string $label): string
{
    echo $label;
    // Windows' CLI has no stty to suppress echo; this is a local dev/
    // bootstrap tool run by the project owner, so plain visible input is
    // an acceptable trade-off rather than pulling in a platform-specific
    // no-echo mechanism.
    $line = fgets(STDIN);
    return $line === false ? '' : trim($line);
}

$username = prompt('Username: ');
if ($username === '') {
    fwrite(STDERR, "Username cannot be empty.\n");
    exit(1);
}

$password = promptPassword('Password: ');
if (strlen($password) < 8) {
    fwrite(STDERR, "Password must be at least 8 characters.\n");
    exit(1);
}

$roleInput = strtolower(prompt('Role (admin/teacher) [admin]: '));
$role = $roleInput === 'teacher' ? 'teacher' : 'admin';

$pdo = bh_db();
$exists = $pdo->prepare('SELECT 1 FROM bh_admins WHERE username = :u');
$exists->execute(['u' => $username]);
if ($exists->fetch()) {
    fwrite(STDERR, "A user with that username already exists.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_ARGON2ID);
$pdo->prepare('INSERT INTO bh_admins (username, password_hash, role) VALUES (:u, :h, :r)')
    ->execute(['u' => $username, 'h' => $hash, 'r' => $role]);

echo "Created {$role} account '{$username}'.\n";
