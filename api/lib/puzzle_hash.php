<?php
/**
 * The "has this puzzle's verification-relevant content changed?" hash
 * (BUILD.md 5.3/8): a puzzle can't be published unless verified_hash
 * matches a hash of buggy_code + fixed_code + tests + entry settings;
 * editing any of those clears verification. Computed purely server-side
 * (from whatever is currently in the database) so there's one definition
 * of "the current content", not two that could drift apart.
 */

/**
 * @param array $puzzle has buggy_code, fixed_code, entry_mode, entry_name
 * @param array[] $tests each with label, args_py, kwargs_py, stdin_text, expect_kind, expect_py, compare_mode, is_hidden/hidden
 */
function bh_puzzle_verification_hash(array $puzzle, array $tests): string
{
    $normalisedTests = array_map(static function (array $t): array {
        return [
            $t['label'] ?? '',
            $t['args_py'] ?? null,
            $t['kwargs_py'] ?? null,
            $t['stdin_text'] ?? null,
            $t['expect_kind'] ?? '',
            $t['expect_py'] ?? '',
            $t['compare_mode'] ?? 'exact',
            (bool) ($t['is_hidden'] ?? $t['hidden'] ?? false),
        ];
    }, $tests);

    $payload = json_encode([
        $puzzle['buggy_code'] ?? '',
        $puzzle['fixed_code'] ?? '',
        $puzzle['entry_mode'] ?? '',
        $puzzle['entry_name'] ?? '',
        $normalisedTests,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

    return hash('sha256', $payload);
}
