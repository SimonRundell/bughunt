import { getBadgeImage } from '../config/badgeImages'

/**
 * A badge's visual: the real artwork from /public/awards when one exists
 * for this id, otherwise a plain geometric placeholder - never an emoji
 * (CLAUDE.md's design brief explicitly avoids emoji-as-icons).
 *
 * @param {object} props
 * @param {string} props.badgeId
 * @param {number} [props.size] - pixels, square
 */
export default function BadgeIcon({ badgeId, size = 40 }) {
  const src = getBadgeImage(badgeId)
  const style = { width: size, height: size }

  if (src) {
    return <img src={src} alt="" className="badge-icon" style={style} />
  }
  return <span className="badge-icon badge-icon--placeholder" style={style} aria-hidden="true" />
}
