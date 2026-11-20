import { Check, Clock3, MoreHorizontal, Pill, SkipForward, X } from 'lucide-react'
import type { DoseOccurrence, RecordedDoseStatus } from '../utils/reminderScheduler'

type Props = { occurrence: DoseOccurrence; compact?: boolean; onAction: (occurrence: DoseOccurrence, status: RecordedDoseStatus) => void; onCorrect?: (occurrence: DoseOccurrence) => void }
const statusLabel = { UPCOMING: 'Upcoming', DUE: 'Due now', TAKEN: 'Taken', SKIPPED: 'Skipped', MISSED: 'Missed' }
const formatTime = (value: string) => {
  const [, time = ''] = value.split('T')
  const [hourText, minute] = time.split(':')
  const hour = Number(hourText)
  if (!Number.isFinite(hour)) return value
  return `${hour % 12 || 12}:${minute ?? '00'} ${hour >= 12 ? 'PM' : 'AM'}`
}

export default function DoseOccurrenceCard({ occurrence, compact = false, onAction, onCorrect }: Props) {
  const { medicine, reminder, status, record } = occurrence
  const final = status === 'TAKEN' || status === 'SKIPPED' || status === 'MISSED'
  return <article className={`dose-occurrence-card ${compact ? 'dose-compact' : ''}`}><span className={`dose-card-icon ${medicine.color}`}><Pill size={16} /></span><div className="dose-card-main"><div className="dose-card-title"><b>{medicine.name}</b><span className={`dose-status-pill dose-${status.toLowerCase()}`}><i />{statusLabel[status]}</span></div><div className="dose-card-meta"><span>{reminder.dosage}</span><span>{formatTime(occurrence.scheduledDateTime)}</span><span>{reminder.frequency}</span></div>{status === 'TAKEN' && record?.completedAt && <small className="dose-completed-time">Taken at {new Date(record.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</small>}</div>{status === 'DUE' && <div className="dose-actions"><button className="dose-taken-action" onClick={() => onAction(occurrence, 'TAKEN')}><Check size={14} /> Taken</button><button className="dose-skip-action" onClick={() => onAction(occurrence, 'SKIPPED')}><SkipForward size={13} /> Skip</button><button className="dose-missed-action" onClick={() => onAction(occurrence, 'MISSED')}><X size={13} /> Missed</button></div>}{status === 'UPCOMING' && <span className="dose-upcoming-time"><Clock3 size={13} /> {formatTime(occurrence.scheduledDateTime)}</span>}{final && record && onCorrect && <button className="dose-correct-button" onClick={() => onCorrect(occurrence)} title="Correct this recorded status" aria-label={`Correct ${medicine.name} dose`}><MoreHorizontal size={17} /></button>}</article>
}
