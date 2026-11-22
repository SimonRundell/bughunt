/**
 * Maps badge ids to the artwork supplied in /public/awards. Badges without
 * dedicated art yet fall back to a plain geometric placeholder in
 * BadgeIcon, not an emoji (CLAUDE.md's design brief explicitly avoids
 * emoji-as-icons).
 */
const BADGE_IMAGES = {
  'first-fix': '/awards/firstfix.png',
  'read-the-error': '/awards/readtheerror.png',
  'no-hints-track': '/awards/nohints.png',
  'boss-slayer': '/awards/boss-slayer.png',
  'trace-master': '/awards/tracemaster.png',
  'streak-5': '/awards/streak-5.png',
  'streak-10': '/awards/streak-10.png',
  'streak-20': '/awards/streak-20.png',
  'streak-50': '/awards/streak-50.png',
  'streak-100': '/awards/streak-100.png',
  'streak-200': '/awards/streak-200.png',
  'streak-500': '/awards/streak-500.png',
  'streak-1000': '/awards/streak-1000.png',
}

/** Per-track "Track Complete" art. */
const TRACK_COMPLETE_IMAGES = {
  'spot-the-typo': '/awards/trackcomplete-spotthetypo.png',
  'crash-course': '/awards/trackcomplete-crashcourse.png',
  'wrong-answer': '/awards/trackcomplete-wronganswer.png',
  'deep-bugs': '/awards/trackcomplete-deepbugs.png',
  'boss-fights': '/awards/trackcomplete-bossfights.png',
}

/** @param {string} badgeId @returns {string|null} */
export function getBadgeImage(badgeId) {
  if (BADGE_IMAGES[badgeId]) return BADGE_IMAGES[badgeId]
  if (badgeId.startsWith('track-complete-')) {
    const trackSlug = badgeId.replace('track-complete-', '')
    return TRACK_COMPLETE_IMAGES[trackSlug] ?? null
  }
  return null
}
