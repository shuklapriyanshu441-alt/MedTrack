import { AlertCircle, CalendarClock, CalendarDays, CheckCircle2, Package } from 'lucide-react'
import type { Medicine } from '../data/dashboardData'
import { calculateExpiry } from '../utils/expiryCalculator'

export default function ExpirySummaryCards({ medicines }: { medicines: Medicine[] }) {
  const results = medicines.map(medicine => calculateExpiry(medicine.expiryDate))
  const cards = [
    { label: 'Total medicines', value: medicines.length, note: 'In your cabinet', color: 'mint', icon: Package },
    { label: 'Expired medicines', value: results.filter(result => result.status === 'EXPIRED').length, note: 'Past recorded expiry', color: 'red', icon: AlertCircle },
    { label: 'Within 7 days', value: results.filter(result => result.status === 'EXPIRING_SOON').length, note: 'Including today', color: 'orange', icon: CalendarClock },
    { label: 'Within 30 days', value: results.filter(result => result.status === 'EXPIRING_SOON' || result.status === 'EXPIRING').length, note: 'Upcoming expiry dates', color: 'yellow', icon: CalendarDays },
    { label: 'More than 30 days', value: results.filter(result => result.status === 'SAFE').length, note: 'Recorded date is further away', color: 'green', icon: CheckCircle2 },
  ]
  return <section className="expiry-summary-grid" aria-label="Expiry summary">{cards.map(({ label, value, note, color, icon: Icon }) => <article className="expiry-summary-card" key={label}><span className={`expiry-summary-icon ${color}`}><Icon size={17} /></span><div><span>{label}</span><b>{value}</b><small>{note}</small></div></article>)}</section>
}
