import type { ExpiryStatus } from '../utils/expiryCalculator'

const labels: Record<ExpiryStatus, string> = { EXPIRED: 'Expired', EXPIRING_SOON: 'Within 7 days', EXPIRING: 'Within 30 days', SAFE: 'More than 30 days', INVALID: 'Invalid date' }
export default function ExpiryStatusBadge({ status }: { status: ExpiryStatus }) {
  return <span className={`expiry-status-badge expiry-${status.toLowerCase()}`}><i />{labels[status]}</span>
}
