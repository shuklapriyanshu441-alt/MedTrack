import { Trash2, X } from 'lucide-react'
import type { Medicine } from '../data/dashboardData'

type Props = { medicine: Medicine; onCancel: () => void; onConfirm: () => void }
export default function DeleteMedicineDialog({ medicine, onCancel, onConfirm }: Props) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}><section className="medicine-modal delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-medicine-title"><div className="delete-icon"><Trash2 size={20} /></div><button className="modal-close delete-close" onClick={onCancel} aria-label="Close confirmation"><X size={18} /></button><h2 id="delete-medicine-title">Remove this medicine?</h2><p><b>{medicine.name}</b> will be removed from your inventory. You can add it again later.</p><div className="modal-actions"><button className="cancel-button" onClick={onCancel}>Keep medicine</button><button className="confirm-delete" onClick={onConfirm}><Trash2 size={15} /> Remove medicine</button></div></section></div>
}
