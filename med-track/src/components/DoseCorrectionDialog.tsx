import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { DoseOccurrence, RecordedDoseStatus } from '../utils/reminderScheduler'

type Props = { occurrence: DoseOccurrence; onCancel: () => void; onConfirm: (status: RecordedDoseStatus) => void }
export default function DoseCorrectionDialog({ occurrence, onCancel, onConfirm }: Props) {
  const [status, setStatus] = useState<RecordedDoseStatus>(occurrence.record?.status ?? 'TAKEN')
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}><section className="medicine-modal small-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dose-correction-title"><button className="modal-close confirm-close" onClick={onCancel} aria-label="Close correction"><X size={18} /></button><span className="confirm-symbol correction"><Check size={18} /></span><h2 id="dose-correction-title">Correct dose status</h2><p><b>{occurrence.medicine.name}</b> · {occurrence.reminder.dosage}<br />Recorded as {occurrence.record?.status.toLowerCase()}.</p><label className="correction-select">Change status to<select value={status} onChange={event => setStatus(event.target.value as RecordedDoseStatus)}><option value="TAKEN">Taken</option><option value="SKIPPED">Skipped</option><option value="MISSED">Missed</option></select></label><div className="correction-note">This explicit correction will replace the current status in history.</div><div className="modal-actions"><button className="cancel-button" onClick={onCancel}>Cancel</button><button className="add-button" onClick={() => onConfirm(status)}><Check size={14} /> Save correction</button></div></section></div>
}
