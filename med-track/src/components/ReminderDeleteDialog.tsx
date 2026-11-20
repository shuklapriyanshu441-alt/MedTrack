import { BellRing, Trash2, X } from 'lucide-react'
import type { MedicineReminder } from '../utils/reminderScheduler'
import type { Medicine } from '../data/dashboardData'

type Props = { reminder: MedicineReminder; medicine?: Medicine; onCancel: () => void; onConfirm: () => void }
export default function ReminderDeleteDialog({ reminder, medicine, onCancel, onConfirm }: Props) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}><section className="medicine-modal small-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reminder-delete-title"><button className="modal-close confirm-close" onClick={onCancel} aria-label="Close confirmation"><X size={18} /></button><span className="confirm-symbol missed"><BellRing size={18} /></span><h2 id="reminder-delete-title">Delete this reminder?</h2><p>The reminder for <b>{medicine?.name ?? 'this medicine'}</b> will be removed.</p><small className="delete-reminder-schedule">{reminder.frequency} · {reminder.reminderTimes.join(', ')}</small><p className="delete-history-note">Existing dose history will be kept.</p><div className="modal-actions"><button className="cancel-button" onClick={onCancel}>Keep reminder</button><button className="confirm-missed-button" onClick={onConfirm}><Trash2 size={14} /> Delete reminder</button></div></section></div>
}
