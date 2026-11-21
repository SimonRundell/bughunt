/**
 * Maps badge ids to the artwork supplied in /public/awards. Badges without
 * dedicated art yet (trace-master, boss-slayer, streak - Phase 4/5
 * features not fully earnable yet anyway) fall back to a plain geometric
 * placeholder in BadgeIcon, not an emoji (CLAUDE.md's design brief
 * explicitly avoids emoji-as-icons).
 */
const BADGE_IMAGES = {
  'first-fix': '/awards/firstfix.png',
  'read-the-error': '/awards/readtheerror.png',
  'no-hints-track': '/awards/nohints.png',
}

/** @param {string} badgeId @returns {string|null} */
export function getBadgeImage(badgeId) {
  if (BADGE_IMAGES[badgeId]) return BADGE_IMAGES[badgeId]
  if (badgeId.startsWith('track-complete-')) return '/awards/trackcomplete.png'
  return null
}
