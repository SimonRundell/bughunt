import { describeBadge } from '../store/progress'

/**
 * Inline announcement for badges just earned by a solve (not a persistent
 * list - see the Progress page for that). Dismissible; respects
 * prefers-reduced-motion via index.css rather than any JS animation here.
 *
 * @param {object} props
 * @param {string[]} props.badgeIds
 * @param {() => void} props.onDismiss
 */
export default function BadgeToast({ badgeIds, onDismiss }) {
  if (badgeIds.length === 0) return null

  return (
    <div className="badge-toast" role="status">
      <strong>New badge{badgeIds.length > 1 ? 's' : ''}!</strong>
      <ul>
        {badgeIds.map((id) => {
          const info = describeBadge(id)
          return (
            <li key={id}>
              <strong>{info.title}</strong> - {info.description}
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}
