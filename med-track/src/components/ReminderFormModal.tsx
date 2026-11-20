import { useState, type FormEvent } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import type { Medicine } from '../data/dashboardData'
import { dateKey, requiredTimeCount, validateReminderDraft, type MedicineReminder, type MedicineReminderDraft, type ReminderFrequency } from '../utils/reminderScheduler'

type Props = { medicines: Medicine[]; reminder: MedicineReminder | null; onClose: () => void; onSave: (draft: MedicineReminderDraft) => void }
const timesFor: Record<Exclude<ReminderFrequency, 'Custom Schedule'>, string[]> = { 'Once Daily': ['09:00'], 'Twice Daily': ['08:00', '20:00'], 'Three Times Daily': ['08:00', '14:00', '20:00'] }

export default function ReminderFormModal({ medicines, reminder, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<MedicineReminderDraft>(() => reminder ? { medicineId: reminder.medicineId, dosage: reminder.dosage, frequency: reminder.frequency, reminderTimes: [...reminder.reminderTimes], startDate: reminder.startDate, endDate: reminder.endDate } : { medicineId: medicines[0]?.id ?? 0, dosage: '', frequency: 'Once Daily', reminderTimes: ['09:00'], startDate: dateKey(new Date()), endDate: null })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const update = <K extends keyof MedicineReminderDraft>(key: K, value: MedicineReminderDraft[K]) => setDraft(current => ({ ...current, [key]: value }))
  const setFrequency = (frequency: ReminderFrequency) => {
    const required = requiredTimeCount(frequency)
    setDraft(current => ({ ...current, frequency, reminderTimes: required === null ? current.reminderTimes : timesFor[frequency as Exclude<ReminderFrequency, 'Custom Schedule'>] }))
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateReminderDraft(draft, medicines)
    setErrors(validation)
    if (Object.keys(validation).length) return
    onSave({ ...draft, reminderTimes: [...draft.reminderTimes] })
  }
  const fieldError = (key: string) => errors[key] && <small className="field-error">{errors[key]}</small>

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><section className="medicine-modal reminder-form-modal" role="dialog" aria-modal="true" aria-labelledby="reminder-form-title"><div className="modal-heading"><div><span className="section-label">MEDICINE SCHEDULE</span><h2 id="reminder-form-title">{reminder ? 'Edit reminder' : 'Create a reminder'}</h2><p>Choose when you’d like a nudge for each dose.</p></div><button className="modal-close" onClick={onClose} aria-label="Close reminder form"><X size={19} /></button></div>
    {medicines.length === 0 ? <div className="reminder-no-medicines">Add a medicine to your cabinet before creating a reminder.</div> : <form onSubmit={submit} noValidate>
      <div className="form-row"><label>Medicine <span className="required-mark">*</span><select value={draft.medicineId || ''} onChange={event => update('medicineId', Number(event.target.value))}><option value="" disabled>Select a medicine</option>{medicines.map(medicine => <option key={medicine.id} value={medicine.id}>{medicine.name} · {medicine.category}</option>)}</select>{fieldError('medicineId')}</label><label>Dosage per dose <span className="required-mark">*</span><input value={draft.dosage} onChange={event => update('dosage', event.target.value)} placeholder="e.g. 1 tablet · 500 mg" />{fieldError('dosage')}</label></div>
      <div className="form-row"><label>Frequency <span className="required-mark">*</span><select value={draft.frequency} onChange={event => setFrequency(event.target.value as ReminderFrequency)}><option>Once Daily</option><option>Twice Daily</option><option>Three Times Daily</option><option>Custom Schedule</option></select></label><label>Start date <span className="required-mark">*</span><input type="date" value={draft.startDate} onChange={event => update('startDate', event.target.value)} />{fieldError('startDate')}</label></div>
      <div className="reminder-times-editor"><div className="reminder-times-title"><span>Reminder times <span className="required-mark">*</span></span>{draft.frequency === 'Custom Schedule' && draft.reminderTimes.length < 8 && <button type="button" className="add-time-button" onClick={() => { const options = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00']; update('reminderTimes', [...draft.reminderTimes, options.find(time => !draft.reminderTimes.includes(time)) ?? '23:00']) }}><Plus size={13} /> Add time</button>}</div>{draft.reminderTimes.map((time, index) => <div className="reminder-time-input" key={index}><span>Dose {index + 1}</span><input aria-label={`Reminder time ${index + 1}`} type="time" value={time} onChange={event => update('reminderTimes', draft.reminderTimes.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />{draft.frequency === 'Custom Schedule' && draft.reminderTimes.length > 1 && <button type="button" aria-label={`Remove reminder time ${index + 1}`} onClick={() => update('reminderTimes', draft.reminderTimes.filter((_, itemIndex) => itemIndex !== index))}><Minus size={14} /></button>}</div>)}{fieldError('reminderTimes')}</div>
      <div className="form-row"><label>End date <span className="optional-label">Optional</span><input type="date" value={draft.endDate ?? ''} min={draft.startDate} onChange={event => update('endDate', event.target.value || null)} />{fieldError('endDate')}</label><div className="schedule-hint"><ClockIcon /> Times repeat daily between the start and end dates.</div></div>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="add-button" type="submit"><Plus size={16} /> {reminder ? 'Save reminder' : 'Create reminder'}</button></div>
    </form>}</section></div>
}

function ClockIcon() { return <span className="schedule-hint-icon">↻</span> }
