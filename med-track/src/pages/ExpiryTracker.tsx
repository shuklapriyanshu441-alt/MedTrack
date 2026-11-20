import { useMemo, useState } from 'react'
import { ArrowDownAZ, ArrowDownWideNarrow, ArrowUpWideNarrow, Search, SlidersHorizontal } from 'lucide-react'
import type { Medicine } from '../data/dashboardData'
import { calculateExpiry, sortExpiryMedicines, type ExpirySort } from '../utils/expiryCalculator'
import ExpirySummaryCards from '../components/ExpirySummaryCards'
import ExpiryTable from '../components/ExpiryTable'

type Filter = 'all' | 'expired' | 'within7' | 'within30' | 'more30'
type Sort = ExpirySort
const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All medicines' }, { key: 'expired', label: 'Expired' }, { key: 'within7', label: 'Within 7 days' }, { key: 'within30', label: 'Within 30 days' }, { key: 'more30', label: 'More than 30 days' },
]

export default function ExpiryTracker({ medicines, onSelect }: { medicines: Medicine[]; onSelect: (medicine: Medicine) => void }) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('earliest')
  const [search, setSearch] = useState('')
  const visible = useMemo(() => sortExpiryMedicines(medicines.filter(medicine => {
    const result = calculateExpiry(medicine.expiryDate)
    const matchesSearch = medicine.name.toLowerCase().includes(search.trim().toLowerCase())
    const matchesFilter = filter === 'all' || (filter === 'expired' && result.status === 'EXPIRED') || (filter === 'within7' && result.status === 'EXPIRING_SOON') || (filter === 'within30' && (result.status === 'EXPIRING_SOON' || result.status === 'EXPIRING')) || (filter === 'more30' && result.status === 'SAFE')
    return matchesSearch && matchesFilter
  }), sort), [medicines, filter, sort, search])

  return <div className="dashboard-body expiry-page-body"><div className="expiry-page-heading"><div><span className="eyebrow">MEDICINE SAFETY OVERVIEW</span><h2>Expiry tracker</h2><p>Keep an eye on recorded expiry dates across your cabinet.</p></div><div className="expiry-date-note"><SlidersHorizontal size={15} /><span>Dates are compared by calendar day</span></div></div>
    <ExpirySummaryCards medicines={medicines} />
    <section className="panel expiry-tracker-panel"><div className="expiry-tracker-header"><div><div className="section-label">YOUR MEDICINE CABINET</div><h3>Expiry overview <span className="count-pill">{visible.length}</span></h3><p className="panel-subtitle">Select a medicine to see its full details.</p></div><label className="expiry-search"><Search size={16} /><input aria-label="Search medicine name" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search medicines..." /></label></div>
      <div className="expiry-controls"><div className="expiry-filter-tabs" role="tablist" aria-label="Filter by expiry status">{filters.map(item => <button key={item.key} role="tab" aria-selected={filter === item.key} className={filter === item.key ? 'active' : ''} onClick={() => setFilter(item.key)}>{item.label}<span>{item.key === 'all' ? medicines.length : item.key === 'expired' ? medicines.filter(m => calculateExpiry(m.expiryDate).status === 'EXPIRED').length : item.key === 'within7' ? medicines.filter(m => calculateExpiry(m.expiryDate).status === 'EXPIRING_SOON').length : item.key === 'within30' ? medicines.filter(m => ['EXPIRING_SOON', 'EXPIRING'].includes(calculateExpiry(m.expiryDate).status)).length : medicines.filter(m => calculateExpiry(m.expiryDate).status === 'SAFE').length}</span></button>)}</div><label className="expiry-sort"><span>Sort</span><select value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="earliest">Earliest expiry</option><option value="latest">Latest expiry</option><option value="name">Medicine name</option><option value="days">Days remaining</option></select>{sort === 'latest' ? <ArrowUpWideNarrow size={14} /> : sort === 'name' ? <ArrowDownAZ size={14} /> : <ArrowDownWideNarrow size={14} />}</label></div>
      <ExpiryTable medicines={visible} onSelect={onSelect} />
    </section><p className="expiry-footnote">Expiry status reflects the date entered for each medicine. “More than 30 days” describes the recorded date only and is not a medical safety assessment.</p>
  </div>
}
