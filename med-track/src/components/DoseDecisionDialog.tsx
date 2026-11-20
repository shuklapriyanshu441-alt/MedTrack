import { SkipForward, X } from 'lucide-react'
import type { DoseOccurrence, RecordedDoseStatus } from '../utils/reminderScheduler'

type Props = { occurrence: DoseOccurrence; action: Extract<RecordedDoseStatus, 'SKIPPED' | 'MISSED'>; onCancel: () => void; onConfirm: () => void }
export default function DoseDecisionDialog({ occurrence, action, onCancel, onConfirm }: Props) {
  const skipped = action === 'SKIPPED'
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel() }}><section className="medicine-modal small-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="dose-decision-title"><button className="modal-close confirm-close" onClick={onCancel} aria-label="Close confirmation"><X size={18} /></button><span className={`confirm-symbol ${skipped ? 'skip' : 'missed'}`}>{skipped ? <SkipForward size={18} /> : <X size={19} />}</span><h2 id="dose-decision-title">{skipped ? 'Skip this dose?' : 'Mark this dose as missed?'}</h2><p><b>{occurrence.medicine.name}</b> · {occurrence.reminder.dosage}. This status will be recorded in dose history.</p><div className="modal-actions"><button className="cancel-button" onClick={onCancel}>Go back</button><button className={skipped ? 'confirm-skip-button' : 'confirm-missed-button'} onClick={onConfirm}>{skipped ? <SkipForward size={14} /> : <X size={14} />}{skipped ? 'Confirm skip' : 'Confirm missed'}</button></div></section></div>
}
