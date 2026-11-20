import { useRef, useState, type ChangeEvent } from 'react'
import { Bell, Download, FileUp, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import type { ApplicationData, AppSettings } from '../types/applicationData'
import type { BrowserNotificationPermission } from '../utils/browserNotifications'
import { exportApplicationData, parseApplicationDataImport } from '../utils/dataMigration'

type Props = { data: ApplicationData; settings: AppSettings; permission: BrowserNotificationPermission; storageError: string | null; onSettings: (settings: AppSettings) => void; onRequestNotifications: () => Promise<BrowserNotificationPermission>; onImport: (data: ApplicationData) => string | null; onClear: () => string | null; onResetDemo: () => string | null }
type ConfirmMode = 'import' | 'clear' | 'reset' | null

export default function SettingsPage({ data, settings, permission, storageError, onSettings, onRequestNotifications, onImport, onClear, onResetDemo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<ConfirmMode>(null)
  const [pendingImport, setPendingImport] = useState<ApplicationData | null>(null)
  const [message, setMessage] = useState('')
  const patch = (values: Partial<AppSettings>) => onSettings({ ...settings, ...values })
  const download = () => {
    const file = new Blob([exportApplicationData(data)], { type: 'application/json' })
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `meditrack-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage('Your MediTrack backup has been downloaded.')
  }
  const selectImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = parseApplicationDataImport(await file.text())
      if (!imported) { setMessage('This file is not a valid MediTrack backup. Your current data was not changed.'); return }
      setPendingImport(imported); setConfirm('import'); setMessage('')
    } catch { setMessage('The selected file could not be read. Your current data was not changed.') }
  }
  const confirmAction = () => {
    let failure: string | null = null
    if (confirm === 'import' && pendingImport) { failure = onImport(pendingImport); if (!failure) { setMessage('Backup imported. Your application data has been replaced.'); setPendingImport(null) } }
    if (confirm === 'clear') { failure = onClear(); if (!failure) setMessage('All application data has been cleared.') }
    if (confirm === 'reset') { failure = onResetDemo(); if (!failure) setMessage('Demo data has been restored.') }
    if (failure) setMessage(failure)
    setConfirm(null)
  }
  const toggleBrowser = async (enabled: boolean) => {
    if (!enabled) { patch({ browserNotificationsEnabled: false }); return }
    const next = await onRequestNotifications()
    patch({ browserNotificationsEnabled: next === 'granted' })
    if (next !== 'granted') setMessage(next === 'denied' ? 'Notifications are blocked in browser settings.' : 'Browser notifications are unavailable or not enabled.')
  }

  return <div className="dashboard-body settings-page"><div className="settings-page-heading"><div><span className="eyebrow">YOUR PREFERENCES</span><h2>Settings & data</h2><p>Control reminders, notifications, and your local MediTrack data.</p></div></div>
    {storageError && <div className="settings-storage-warning"><ShieldCheck size={16}/><span>{storageError}</span></div>}
    <div className="settings-content-grid"><div className="settings-main-column">
      <section className="panel settings-panel"><div className="settings-panel-heading"><span className="settings-icon"><Bell size={17}/></span><div><h3>Notifications</h3><p>Choose which in-app alerts and browser reminders are enabled.</p></div></div>
        <SettingToggle title="Browser notifications" description={`Permission: ${permission}. Requests happen only after you turn this on.`} checked={settings.browserNotificationsEnabled} onChange={toggleBrowser}/>
        <SettingToggle title="Expiry alerts" description="Notify when medicines expire or approach their recorded expiry date." checked={settings.expiryNotifications} onChange={checked=>patch({expiryNotifications:checked})}/>
        <SettingToggle title="Dose reminders" description="Show approaching, due, and missed dose alerts while MediTrack is open." checked={settings.doseNotifications} onChange={checked=>patch({doseNotifications:checked})}/>
        <SettingToggle title="Stock alerts" description="Show alerts after manual stock changes and stock status transitions." checked={settings.stockNotifications} onChange={checked=>patch({stockNotifications:checked})}/>
      </section>
      <section className="panel settings-panel"><div className="settings-panel-heading"><span className="settings-icon settings-green"><ShieldCheck size={17}/></span><div><h3>Tracking preferences</h3><p>Set defaults used by dose and inventory calculations.</p></div></div>
        <label className="settings-field"><span><b>Missed dose grace period</b><small>A due dose becomes missed after this many minutes.</small></span><select value={settings.missedDoseGraceMinutes} onChange={e=>patch({missedDoseGraceMinutes:Number(e.target.value)})}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option><option value={120}>2 hours</option></select></label>
        <label className="settings-field"><span><b>Default low-stock threshold</b><small>Used when adding new medicines. Existing thresholds stay unchanged.</small></span><input type="number" min="0" max="10000" step="1" value={settings.defaultLowStockThreshold} onChange={e=>patch({defaultLowStockThreshold:Math.max(0,Math.min(10000,Number(e.target.value)||0))})}/></label>
      </section>
      <section className="panel settings-panel data-tools-panel"><div className="settings-panel-heading"><span className="settings-icon settings-blue"><FileUp size={17}/></span><div><h3>Data management</h3><p>Your data is saved in this browser only. Make backups before clearing it.</p></div></div>
        <div className="data-action-row"><div><b>Export data</b><small>Download medicines, reminders, history, movements, notifications, and settings.</small></div><button className="settings-action-button" onClick={download}><Download size={14}/> Export JSON</button></div>
        <div className="data-action-row"><div><b>Import data</b><small>Validate a MediTrack backup before replacing current browser data.</small></div><input ref={inputRef} type="file" accept="application/json,.json" hidden onChange={selectImport}/><button className="settings-action-button" onClick={()=>inputRef.current?.click()}><FileUp size={14}/> Choose file</button></div>
        <div className="data-action-row"><div><b>Reset demo data</b><small>Restore the starter medicines and reminder examples.</small></div><button className="settings-action-button" onClick={()=>setConfirm('reset')}><RotateCcw size={14}/> Reset demo</button></div>
        <div className="data-action-row danger-row"><div><b>Clear all data</b><small>Remove saved medicines, schedules, dose history, movements, and alerts.</small></div><button className="settings-danger-button" onClick={()=>setConfirm('clear')}><Trash2 size={14}/> Clear data</button></div>
      </section>
      {message&&<p className="settings-feedback" role="status">{message}</p>}
    </div><aside className="settings-side-column"><section className="panel settings-storage-card"><span className="settings-storage-mark"><ShieldCheck size={19}/></span><h3>Private by design</h3><p>Your information stays in this browser’s LocalStorage. It is not sent to a server.</p><div><small>MEDICINES</small><b>{data.medicines.length}</b></div><div><small>DOSE RECORDS</small><b>{data.doseRecords.length}</b></div><div><small>STOCK MOVEMENTS</small><b>{data.stockMovements.length}</b></div></section><p className="settings-limit-note">Browser notifications require permission and work while the app is open. LocalStorage does not provide background alerts.</p></aside></div>
    {confirm&&<div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget){setConfirm(null);setPendingImport(null)}}}><section className="medicine-modal settings-confirm" role="alertdialog" aria-modal="true" aria-labelledby="settings-confirm-title"><span className="settings-confirm-icon">{confirm==='clear'?<Trash2 size={19}/>:confirm==='reset'?<RotateCcw size={19}/>:<FileUp size={19}/>}</span><h2 id="settings-confirm-title">{confirm==='clear'?'Clear all MediTrack data?':confirm==='reset'?'Restore demo data?':'Replace data with this backup?'}</h2><p>{confirm==='clear'?'This removes all current medicines, reminders, dose history, stock movements, and notifications from this browser.':confirm==='reset'?'Current data will be replaced with the starter sample medicines and reminders.':'Your current data will be replaced. The backup has been validated before this confirmation.'}</p><div className="modal-actions"><button className="cancel-button" onClick={()=>{setConfirm(null);setPendingImport(null)}}>Cancel</button><button className={confirm==='clear'?'settings-danger-button':'add-button'} onClick={confirmAction}>{confirm==='clear'?'Clear all data':confirm==='reset'?'Restore demo data':'Import backup'}</button></div></section></div>}
  </div>
}
function SettingToggle({title,description,checked,onChange}:{title:string;description:string;checked:boolean;onChange:(checked:boolean)=>void|Promise<void>}){return <label className="setting-toggle"><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={checked} onChange={event=>void onChange(event.target.checked)}/><i/></label>}
