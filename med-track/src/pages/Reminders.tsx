import { useMemo, useState } from 'react'
import { Bell, BellRing, CalendarDays, Check, ChevronDown, Clock3, History, Pause, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import type { Medicine } from '../data/dashboardData'
import type { DoseRecord, DoseOccurrence, MedicineReminder, MedicineReminderDraft, RecordedDoseStatus } from '../utils/reminderScheduler'
import { DEFAULT_MISSED_GRACE_MINUTES, dateKey, enumerateScheduledOccurrences } from '../utils/reminderScheduler'
import ReminderFormModal from '../components/ReminderFormModal'
import DoseOccurrenceCard from '../components/DoseOccurrenceCard'
import DoseDecisionDialog from '../components/DoseDecisionDialog'
import DoseCorrectionDialog from '../components/DoseCorrectionDialog'
import ReminderDeleteDialog from '../components/ReminderDeleteDialog'

type HistoryRange = 'today' | '7days' | '30days' | 'all'
type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'
type Props = {
  medicines: Medicine[]; reminders: MedicineReminder[]; records: DoseRecord[]; now: Date; notificationPermission: PermissionState; graceMinutes?: number
  onEnableNotifications: () => void; onSaveReminder: (draft: MedicineReminderDraft, id?: number) => void
  onToggleReminder: (id: number, active: boolean) => void; onDeleteReminder: (id: number) => void
  onDoseAction: (occurrence: DoseOccurrence, status: RecordedDoseStatus) => void
  onCorrectDose: (recordId: string, status: RecordedDoseStatus) => void
}

export default function Reminders({ medicines, reminders, records, now, notificationPermission, graceMinutes = DEFAULT_MISSED_GRACE_MINUTES, onEnableNotifications, onSaveReminder, onToggleReminder, onDeleteReminder, onDoseAction, onCorrectDose }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<MedicineReminder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MedicineReminder | null>(null)
  const [decision, setDecision] = useState<{ occurrence: DoseOccurrence; status: Extract<RecordedDoseStatus, 'SKIPPED' | 'MISSED'> } | null>(null)
  const [correction, setCorrection] = useState<DoseOccurrence | null>(null)
  const [historyRange, setHistoryRange] = useState<HistoryRange>('today')
  const today = dateKey(now)
  const todayOccurrences = useMemo(() => enumerateScheduledOccurrences(reminders, medicines, today, today, records, now, graceMinutes), [reminders, medicines, today, records, now, graceMinutes])
  const upcoming = todayOccurrences.filter(item => item.status === 'UPCOMING')
  const due = todayOccurrences.filter(item => item.status === 'DUE')
  const taken = todayOccurrences.filter(item => item.status === 'TAKEN')
  const skipped = todayOccurrences.filter(item => item.status === 'SKIPPED')
  const missed = todayOccurrences.filter(item => item.status === 'MISSED')
  const history = useMemo(() => records.filter(record => {
    if (historyRange === 'all') return true
    const days = historyRange === 'today' ? 0 : historyRange === '7days' ? 6 : 29
    const firstDay = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days))
    return record.scheduledDateTime.slice(0, 10) >= firstDay && record.scheduledDateTime.slice(0, 10) <= today
  }).sort((a, b) => b.scheduledDateTime.localeCompare(a.scheduledDateTime)), [records, historyRange, now, today])
  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const saveReminder = (draft: MedicineReminderDraft) => { onSaveReminder(draft, editing?.id); setFormOpen(false); setEditing(null) }
  const handleAction = (occurrence: DoseOccurrence, status: RecordedDoseStatus) => {
    if (status === 'TAKEN') onDoseAction(occurrence, status)
    else setDecision({ occurrence, status })
  }
  const confirmDecision = () => { if (decision) onDoseAction(decision.occurrence, decision.status); setDecision(null) }

  return <div className="dashboard-body reminders-page-body"><div className="reminders-page-heading"><div><span className="eyebrow">YOUR DAILY ROUTINE</span><h2>Medicine reminders</h2><p>Manage schedules and keep track of every dose.</p></div><button className="add-button" onClick={openAdd}><Plus size={16} /> Create reminder</button></div>
    <div className="notification-permission-banner"><span className={`permission-icon permission-${notificationPermission}`}><Bell size={17} /></span><div><b>{notificationPermission === 'granted' ? 'Browser notifications are on' : notificationPermission === 'denied' ? 'Browser notifications are blocked' : notificationPermission === 'unsupported' ? 'Browser notifications unavailable' : 'Get a gentle reminder'}</b><small>{notificationPermission === 'granted' ? 'You may receive alerts while MediTrack is open.' : notificationPermission === 'denied' ? 'Update this site’s notification permission in your browser settings to enable alerts.' : notificationPermission === 'unsupported' ? 'This browser does not support notifications. In-app reminders are still available.' : 'Enable browser notifications to see reminders while the app is open.'}</small></div>{notificationPermission === 'default' && <button className="permission-enable" onClick={onEnableNotifications}><BellRing size={14} /> Enable notifications</button>}</div>

    <section className="dose-summary-grid"><DoseStat label="Scheduled doses" value={todayOccurrences.length} note="On today’s plan" color="mint" icon={<CalendarDays size={17} />} /><DoseStat label="Upcoming doses" value={upcoming.length} note="Later today" color="orange" icon={<Clock3 size={17} />} /><DoseStat label="Due now" value={due.length} note="Ready for your action" color="yellow" icon={<BellRing size={17} />} /><DoseStat label="Completed doses" value={taken.length} note="Marked as taken" color="green" icon={<Check size={17} />} /><DoseStat label="Missed doses" value={missed.length} note={`Past the ${graceMinutes}-minute grace period`} color="red" icon={<X size={17} />} /></section>

    <div className="reminders-main-grid"><div className="reminder-sections-column"><DoseSection title="Due reminders" label="ACTION NEEDED" description="These doses are ready to be marked." occurrences={due} empty="Nothing is due right now." onAction={handleAction} onCorrect={setCorrection} tone="due" /><DoseSection title="Upcoming reminders" label="COMING UP" description="Your next scheduled doses today." occurrences={upcoming} empty="You’re all caught up for the rest of today." onAction={handleAction} onCorrect={setCorrection} tone="upcoming" /><DoseSection title="Completed doses" label="TAKEN TODAY" description="Doses you’ve marked as taken." occurrences={taken} empty="Taken doses will appear here." onAction={handleAction} onCorrect={setCorrection} tone="completed" /><DoseSection title="Missed doses" label="NEEDS A REVIEW" description="Doses that passed their 60-minute grace period." occurrences={missed} empty="No missed doses today." onAction={handleAction} onCorrect={setCorrection} tone="missed" /><DoseSection title="Skipped doses" label="SKIPPED TODAY" description="Doses you chose to skip." occurrences={skipped} empty="No doses have been skipped today." onAction={handleAction} onCorrect={setCorrection} tone="skipped" /></div>
      <aside className="reminders-side-column"><section className="panel daily-timeline-panel"><div className="panel-header"><div><div className="section-label">TODAY · {now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}</div><h3>Daily timeline</h3><p className="panel-subtitle">Your doses in time order.</p></div><Clock3 size={17} className="timeline-heading-icon" /></div>{todayOccurrences.length ? <div className="daily-timeline">{todayOccurrences.map(occurrence => <DoseOccurrenceCard key={occurrence.key} occurrence={occurrence} compact onAction={handleAction} onCorrect={setCorrection} />)}</div> : <div className="reminder-empty-state">No doses are scheduled for today.</div>}</section>
        <section className="panel manage-reminders-panel"><div className="panel-header"><div><div className="section-label">SCHEDULES</div><h3>Your reminders <span className="count-pill">{reminders.length}</span></h3></div><button className="manage-add-button" onClick={openAdd} aria-label="Add reminder"><Plus size={16} /></button></div>{reminders.length === 0 ? <div className="reminder-empty-state">No reminders yet. Create one to set your routine.</div> : <div className="managed-reminder-list">{reminders.map(reminder => { const medicine = medicines.find(item => item.id === reminder.medicineId); return <article className="managed-reminder" key={reminder.id}><span className={`med-icon ${medicine?.color ?? 'mint'}`}><PillIcon /></span><div className="managed-reminder-copy"><b>{medicine?.name ?? 'Medicine removed'}</b><small>{reminder.frequency} · {reminder.reminderTimes.join(', ')}</small><small>{reminder.dosage}</small></div><span className={`reminder-active-tag ${reminder.isActive ? 'is-active' : 'is-paused'}`}>{reminder.isActive ? 'Active' : 'Paused'}</span><div className="managed-reminder-actions"><button aria-label={reminder.isActive ? 'Pause reminder' : 'Resume reminder'} onClick={() => onToggleReminder(reminder.id, !reminder.isActive)}>{reminder.isActive ? <Pause size={14} /> : <Play size={14} />}</button><button aria-label="Edit reminder" onClick={() => { setEditing(reminder); setFormOpen(true) }}><PencilIcon /></button><button aria-label="Delete reminder" onClick={() => setDeleteTarget(reminder)}><Trash2 size={14} /></button></div></article> })}</div>}</section></aside></div>

    <section className="panel dose-history-panel"><div className="panel-header"><div><div className="section-label">YOUR RECORD</div><h3><History size={16} /> Dose history</h3><p className="panel-subtitle">Taken, skipped, and missed dose records.</p></div><label className="history-range-select"><span>Show</span><select value={historyRange} onChange={event => setHistoryRange(event.target.value as HistoryRange)}><option value="today">Today</option><option value="7days">Last 7 days</option><option value="30days">Last 30 days</option><option value="all">All history</option></select><ChevronDown size={13} /></label></div>{history.length === 0 ? <div className="reminder-empty-state">No dose history for this period yet.</div> : <div className="dose-history-table-wrap"><table className="dose-history-table"><thead><tr><th>MEDICINE</th><th>DOSAGE</th><th>SCHEDULED TIME</th><th>ACTUAL COMPLETION</th><th>STATUS</th><th /></tr></thead><tbody>{history.map(record => { const medicine = medicines.find(item => item.id === record.medicineId); return <tr key={record.id}><td><b>{medicine?.name ?? 'Medicine removed'}</b></td><td>{record.dosage}</td><td>{formatDateTime(record.scheduledDateTime)}</td><td>{record.completedAt ? new Date(record.completedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</td><td><DoseStatus status={record.status} /></td><td><button className="history-correct-button" onClick={() => { const occurrence = todayOccurrences.find(item => item.key === record.id) ?? buildHistoryOccurrence(record, medicine, reminders); if (occurrence) setCorrection(occurrence) }} aria-label="Correct dose record"><RotateCcw size={13} /></button></td></tr> })}</tbody></table></div>}</section>
    <p className="reminder-grace-note">Unresolved doses are marked missed {DEFAULT_MISSED_GRACE_MINUTES} minutes after their scheduled time. Browser alerts only work while this app is open and active.</p>
    {formOpen && <ReminderFormModal medicines={medicines} reminder={editing} onClose={() => { setFormOpen(false); setEditing(null) }} onSave={saveReminder} />}
    {decision && <DoseDecisionDialog occurrence={decision.occurrence} action={decision.status} onCancel={() => setDecision(null)} onConfirm={confirmDecision} />}
    {correction && <DoseCorrectionDialog occurrence={correction} onCancel={() => setCorrection(null)} onConfirm={status => { if (correction.record) onCorrectDose(correction.record.id, status); setCorrection(null) }} />}
    {deleteTarget && <ReminderDeleteDialog reminder={deleteTarget} medicine={medicines.find(item => item.id === deleteTarget.medicineId)} onCancel={() => setDeleteTarget(null)} onConfirm={() => { onDeleteReminder(deleteTarget.id); setDeleteTarget(null) }} />}
  </div>
}

function DoseStat({ label, value, note, color, icon }: { label: string; value: number; note: string; color: string; icon: React.ReactNode }) { return <article className="dose-stat-card"><span className={`dose-stat-icon ${color}`}>{icon}</span><div><span>{label}</span><b>{value}</b><small>{note}</small></div></article> }
function DoseSection({ title, label, description, occurrences, empty, onAction, onCorrect, tone }: { title: string; label: string; description: string; occurrences: DoseOccurrence[]; empty: string; onAction: (occurrence: DoseOccurrence, status: RecordedDoseStatus) => void; onCorrect: (occurrence: DoseOccurrence) => void; tone: string }) { return <section className={`panel dose-section dose-section-${tone}`}><div className="dose-section-heading"><div><span className="section-label">{label}</span><h3>{title} <span className="count-pill">{occurrences.length}</span></h3><p className="panel-subtitle">{description}</p></div></div>{occurrences.length ? <div className="dose-section-list">{occurrences.map(occurrence => <DoseOccurrenceCard key={occurrence.key} occurrence={occurrence} onAction={onAction} onCorrect={onCorrect} />)}</div> : <div className="dose-section-empty">{empty}</div>}</section> }
function DoseStatus({ status }: { status: DoseRecord['status'] }) { return <span className={`dose-status-pill dose-${status.toLowerCase()}`}><i />{status.charAt(0) + status.slice(1).toLowerCase()}</span> }
function formatDateTime(value: string) { const date = new Date(`${value}:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
function buildHistoryOccurrence(record: DoseRecord, medicine: Medicine | undefined, reminders: MedicineReminder[]): DoseOccurrence | null { const reminder = reminders.find(item => item.id === record.reminderId); if (!reminder || !medicine) return null; return { key: record.id, reminder, medicine, scheduledDateTime: record.scheduledDateTime, status: record.status, record } }
function PillIcon() { return <span className="managed-pill-dot">●</span> }
function PencilIcon() { return <span className="managed-pencil">✎</span> }
