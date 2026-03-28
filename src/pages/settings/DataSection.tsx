import { useRef, useState, useEffect } from 'react'
import {
  Upload, Download, Trash2, Database, AlertTriangle, FolderPlus, Clock, HardDrive
} from 'lucide-react'
import type { NousAIData, Course } from '../../types'
import { saveBackupHandle, loadBackupHandle, clearBackupHandle } from '../../store'
import type { SectionId } from './settingsTypes'
import { cardBodyStyle, rowStyle, toggleStyle, toggleKnobStyle } from './settingsStyles'
import { formatBytes, createBlankWorkspace } from './settingsHelpers'

interface DataSectionProps {
  data: NousAIData | null
  setData: (d: NousAIData) => void
  importData: (json: string) => void
  exportData: () => string
  backupNow: () => Promise<boolean>
  showToast: (msg: string) => void
  setExpanded: React.Dispatch<React.SetStateAction<Record<SectionId, boolean>>>
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{value}</span>
    </div>
  )
}

export default function DataSection({
  data, setData, importData, exportData, backupNow, showToast,
}: DataSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  // Auto-backup state
  const [autoBackup, setAutoBackup] = useState(localStorage.getItem('nousai-auto-backup') === 'true')
  const [backupFolder, setBackupFolder] = useState<string | null>(null)
  const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem('nousai-last-backup'))
  const [backingUp, setBackingUp] = useState(false)

  useEffect(() => {
    loadBackupHandle().then(h => { if (h) setBackupFolder(h.name); });
  }, []);

  async function handlePickBackupFolder() {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts: { mode: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ mode: 'readwrite' });
      await saveBackupHandle(handle);
      setBackupFolder(handle.name);
      localStorage.setItem('nousai-auto-backup', 'true');
      setAutoBackup(true);
      showToast('Backup folder set: ' + handle.name);
    } catch { /* user cancelled */ }
  }

  async function handleBackupNow() {
    setBackingUp(true);
    const ok = await backupNow();
    setBackingUp(false);
    if (ok) {
      setLastBackup(new Date().toISOString());
      showToast('Backup saved!');
    } else {
      showToast('Backup failed — pick a folder first.');
    }
  }

  function handleToggleAutoBackup() {
    if (!autoBackup && !backupFolder) {
      handlePickBackupFolder();
      return;
    }
    const next = !autoBackup;
    setAutoBackup(next);
    localStorage.setItem('nousai-auto-backup', String(next));
    showToast(next ? 'Auto-backup enabled (hourly)' : 'Auto-backup disabled');
  }

  async function handleClearBackupFolder() {
    await clearBackupHandle();
    setBackupFolder(null);
    setAutoBackup(false);
    localStorage.setItem('nousai-auto-backup', 'false');
    showToast('Backup folder cleared');
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      importData(ev.target?.result as string)
      showToast('Data imported successfully!')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleExport() {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nousai-data-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Data exported!')
  }

  function handleClear() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      indexedDB.deleteDatabase('nousai-companion')
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('nousai-')) keysToRemove.push(key)
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
      window.location.reload()
    }
  }

  function handleCreateBlankWorkspace() {
    if (data) {
      if (!confirm('You already have data loaded. Creating a blank workspace will replace it. Continue?')) {
        return
      }
    }
    setData(createBlankWorkspace() as NousAIData)
    showToast('Blank workspace created!')
  }

  const stats = data ? {
    quizzes: data.pluginData?.quizHistory?.length || 0,
    courses: data.pluginData?.coachData?.courses?.length || 0,
    flashcards: data.pluginData?.coachData?.courses?.reduce((sum: number, c: Course) => sum + (c.flashcards?.length || 0), 0) || 0,
    events: data.settings?.canvasEvents?.length || 0,
    srCards: data.pluginData?.srData?.cards?.length || 0,
    notes: data.pluginData?.notes?.length || 0,
    drawings: data.pluginData?.drawings?.length || 0,
    matchSets: data.pluginData?.matchSets?.length || 0,
    size: new Blob([JSON.stringify(data)]).size,
  } : null

  return (
    <div style={cardBodyStyle}>
      {/* Import / Export */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input type="file" ref={fileRef} accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <button className="btn btn-primary" onClick={() => fileRef.current?.click()} style={{ flex: '1 1 auto' }}>
          <Upload size={15} /> Import data.json
        </button>
        <button className="btn btn-secondary" onClick={handleExport} style={{ flex: '1 1 auto' }}>
          <Download size={15} /> Export Data
        </button>
      </div>

      {/* Storage warning when approaching browser limit */}
      {stats && stats.size > 4_000_000 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.4)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--accent)' }}>
          ⚠️ Storage is {formatBytes(stats.size)} — approaching the browser limit (~5–10 MB). Consider exporting a backup and clearing old data to free space.
        </div>
      )}

      {/* Auto-Backup */}
      <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        <div style={rowStyle}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-Backup</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Save a local backup every hour</div>
          </div>
          <button style={toggleStyle(autoBackup)} onClick={handleToggleAutoBackup}>
            <div style={toggleKnobStyle(autoBackup)} />
          </button>
        </div>
        {backupFolder && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <FolderPlus size={13} />
              <span>Folder: <strong>{backupFolder}</strong></span>
              <button onClick={handleClearBackupFolder} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>Change</button>
            </div>
            {lastBackup && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                <Clock size={12} />
                <span>Last backup: {new Date(lastBackup).toLocaleString()}</span>
              </div>
            )}
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={handleBackupNow} disabled={backingUp}>
              <HardDrive size={13} /> {backingUp ? 'Saving...' : 'Backup Now'}
            </button>
          </div>
        )}
        {!backupFolder && (
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={handlePickBackupFolder}>
            <FolderPlus size={13} /> Choose Backup Folder
          </button>
        )}
      </div>

      {/* Create Blank Workspace */}
      <button
        className="btn btn-secondary"
        style={{ width: '100%', marginBottom: 16 }}
        onClick={handleCreateBlankWorkspace}
      >
        <FolderPlus size={15} /> Create Blank Workspace
      </button>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -10, marginBottom: 16 }}>
        Start fresh without importing. Creates an empty workspace with default settings.
      </p>

      {/* Data Overview Stats */}
      {stats && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Database size={12} /> Data Overview
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            <StatRow label="Quiz attempts" value={stats.quizzes} />
            <StatRow label="Courses" value={stats.courses} />
            <StatRow label="Flashcards" value={stats.flashcards} />
            <StatRow label="Canvas events" value={stats.events} />
            <StatRow label="SR cards" value={stats.srCards} />
            <StatRow label="Notes" value={stats.notes} />
            <StatRow label="Drawings" value={stats.drawings} />
            <StatRow label="Match sets" value={stats.matchSets} />
            <StatRow label="Data size" value={formatBytes(stats.size)} />
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div style={{
        padding: 14,
        background: 'rgba(239,68,68,0.04)',
        border: '1px solid rgba(239,68,68,0.15)',
        borderRadius: 'var(--radius-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <AlertTriangle size={14} style={{ color: 'var(--red, #ef4444)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red, #ef4444)' }}>Danger Zone</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Clear all locally stored data. This action cannot be undone.
        </p>
        <button
          className="btn btn-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red, #ef4444)', border: '1px solid var(--red, #ef4444)' }}
          onClick={handleClear}
        >
          <Trash2 size={14} /> Clear All Local Data
        </button>
      </div>
    </div>
  )
}
