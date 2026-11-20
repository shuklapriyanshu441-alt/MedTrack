import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { medicineCategories, medicineTypes, type Medicine, type MedicineCategory, type MedicineType } from '../data/dashboardData'
import { validateMedicineDraft, type MedicineDraft } from '../data/medicineManagement'

type Props = { medicine: Medicine | null; onClose: () => void; onSave: (draft: MedicineDraft) => void; defaultThreshold?: number }
const emptyDraft: MedicineDraft = { name: '', category: 'Other', type: 'Tablet', quantity: 1, lowStockThreshold: 7, unit: 'tablets', expiryDate: '', purchaseDate: '', dosage: '', frequency: 'Once daily', reminderTime: '', manufacturer: '', notes: '' }

export default function MedicineFormModal({ medicine, onClose, onSave, defaultThreshold = 7 }: Props) {
  const [draft, setDraft] = useState<MedicineDraft>(() => medicine ? { name: medicine.name, category: medicine.category, type: medicine.type, quantity: medicine.quantity, lowStockThreshold: medicine.lowStockThreshold ?? defaultThreshold, purchasePrice: medicine.purchasePrice, unit: medicine.unit, expiryDate: medicine.expiryDate, purchaseDate: medicine.purchaseDate, dosage: medicine.dosage, frequency: medicine.frequency, reminderTime: medicine.reminderTime, manufacturer: medicine.manufacturer, notes: medicine.notes } : { ...emptyDraft, lowStockThreshold: defaultThreshold })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const change = (key: keyof MedicineDraft, value: string | number) => setDraft(current => ({ ...current, [key]: value }))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = validateMedicineDraft(draft)
    setErrors(next)
    if (Object.keys(next).length) return
    onSave({ ...draft, name: draft.name.trim(), dosage: draft.dosage.trim(), quantity: Number(draft.quantity), manufacturer: draft.manufacturer.trim(), notes: draft.notes.trim() })
  }
  const error = (key: string) => errors[key] && <small className="field-error">{errors[key]}</small>
  const fieldClass = (key: string) => errors[key] ? 'field-invalid' : ''

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="medicine-modal medicine-form-modal" role="dialog" aria-modal="true" aria-labelledby="medicine-form-title"><div className="modal-heading"><div><span className="section-label">YOUR MEDICINE CABINET</span><h2 id="medicine-form-title">{medicine ? 'Edit medicine' : 'Add a medicine'}</h2><p>Keep your medicine details up to date.</p></div><button type="button" className="modal-close" onClick={onClose} aria-label="Close modal"><X size={19} /></button></div>
    <form onSubmit={submit} noValidate>
      <div className="form-row"><label>Medicine name <span className="required-mark">*</span><input className={fieldClass('name')} value={draft.name} onChange={e => change('name', e.target.value)} placeholder="e.g. Amoxicillin" autoFocus />{error('name')}</label><label>Category <span className="required-mark">*</span><select className={fieldClass('category')} value={draft.category} onChange={e => change('category', e.target.value as MedicineCategory)}>{medicineCategories.map(option => <option key={option}>{option}</option>)}</select>{error('category')}</label></div>
      <div className="form-row"><label>Medicine type <span className="required-mark">*</span><select className={fieldClass('type')} value={draft.type} onChange={e => change('type', e.target.value as MedicineType)}>{medicineTypes.map(option => <option key={option}>{option}</option>)}</select>{error('type')}</label><label>Quantity <span className="required-mark">*</span><div className="quantity-input"><input className={fieldClass('quantity')} type="number" min="0" step="1" value={draft.quantity} onChange={e => change('quantity', e.target.value === '' ? 0 : Number(e.target.value))} placeholder="e.g. 30" /><input className={fieldClass('unit')} value={draft.unit} onChange={e => change('unit', e.target.value)} aria-label="Quantity unit" placeholder="unit" /></div>{error('quantity')}{error('unit')}</label></div>
      <div className="form-row"><label>Low-stock threshold<input className={fieldClass('lowStockThreshold')} type="number" min="0" step="1" value={draft.lowStockThreshold} onChange={e => change('lowStockThreshold', e.target.value === '' ? 0 : Number(e.target.value))} />{error('lowStockThreshold')}</label><label>Purchase price per unit <input type="number" min="0" step="0.01" value={draft.purchasePrice ?? ''} onChange={e => setDraft(current => ({ ...current, purchasePrice: e.target.value === '' ? undefined : Number(e.target.value) }))} placeholder="Optional" /></label></div>
      <div className="form-row"><label>Expiry date <span className="required-mark">*</span><input className={fieldClass('expiryDate')} type="date" value={draft.expiryDate} onChange={e => change('expiryDate', e.target.value)} />{error('expiryDate')}</label><label>Purchase date <span className="required-mark">*</span><input className={fieldClass('purchaseDate')} type="date" value={draft.purchaseDate} onChange={e => change('purchaseDate', e.target.value)} />{error('purchaseDate')}</label></div>
      <div className="form-row"><label>Dosage <span className="required-mark">*</span><input className={fieldClass('dosage')} value={draft.dosage} onChange={e => change('dosage', e.target.value)} placeholder="e.g. 500 mg" />{error('dosage')}</label><label>Frequency <span className="required-mark">*</span><select className={fieldClass('frequency')} value={draft.frequency} onChange={e => change('frequency', e.target.value)}><option>Once daily</option><option>Twice daily</option><option>Three times daily</option><option>Every 4 hours</option><option>Every 6 hours</option><option>Weekly</option><option>As needed</option><option>Other</option></select>{error('frequency')}</label></div>
      <div className="form-row"><label>Reminder time <input type="time" value={draft.reminderTime} onChange={e => change('reminderTime', e.target.value)} /></label><label>Manufacturer <input value={draft.manufacturer} onChange={e => change('manufacturer', e.target.value)} placeholder="e.g. Acme Pharma" /></label></div>
      <label>Notes <textarea value={draft.notes} onChange={e => change('notes', e.target.value)} placeholder="Optional instructions or notes" rows={2} /></label>
      <div className="modal-actions"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="add-button" type="submit"><Plus size={16} /> {medicine ? 'Save changes' : 'Add medicine'}</button></div>
    </form></section></div>
}
