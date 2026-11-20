import { Eye } from 'lucide-react'
import { formatDate, type Medicine } from '../data/dashboardData'
import { calculateExpiry } from '../utils/expiryCalculator'
import ExpiryStatusBadge from './ExpiryStatusBadge'

export default function ExpiryTable({ medicines, onSelect }: { medicines: Medicine[]; onSelect: (medicine: Medicine) => void }) {
  return <div className="table-scroll expiry-table-scroll"><table className="expiry-table"><thead><tr><th>MEDICINE</th><th>CATEGORY</th><th>QUANTITY</th><th>EXPIRY DATE</th><th>DAYS REMAINING</th><th>EXPIRY STATUS</th><th>ACTION</th></tr></thead><tbody>{medicines.map(medicine => {
    const result = calculateExpiry(medicine.expiryDate)
    const days = result.daysRemaining
    const remaining = days === null ? '—' : days < 0 ? `${Math.abs(days)} days ago` : days === 0 ? 'Today' : `${days} days`
    return <tr key={medicine.id}><td><div className="medicine-cell"><span className={`med-icon ${medicine.color}`}>{medicine.initials}</span><span><b>{medicine.name}</b><small>{medicine.type} · {medicine.dosage}</small></span></div></td><td><span className="category-text">{medicine.category}</span></td><td><span className="quantity">{medicine.quantity} <small>{medicine.unit}</small></span></td><td><span className="expiry-text">{formatDate(medicine.expiryDate)}</span></td><td><span className={`days-remaining ${result.status === 'EXPIRED' ? 'days-past' : result.status === 'EXPIRING_SOON' ? 'days-urgent' : ''}`}>{remaining}</span></td><td><ExpiryStatusBadge status={result.status} /></td><td><button className="expiry-view-button" onClick={() => onSelect(medicine)} aria-label={`View ${medicine.name} details`}><Eye size={15} /><span>Details</span></button></td></tr>
  })}</tbody></table>{medicines.length === 0 && <div className="expiry-empty-state">No medicines match these expiry filters.</div>}</div>
}
