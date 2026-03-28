import { useState } from 'react'
import { Bell, Mic, Sun, Clipboard, HardDrive, FileText, Wifi } from 'lucide-react'
import {
  checkAllPermissions, requestMicrophone, requestPersistentStorage,
  registerBackgroundSync, isWakeLockSupported, isClipboardSupported,
  isBackgroundSyncSupported, isFileSystemAccessSupported, isPersistentStorageSupported,
  getPermPref, setPermPref, type AllPermissions
} from '../../utils/permissions'
import { requestFCMPermission, getFCMToken, clearFCMToken, isFCMSupported } from '../../utils/fcm'
import { cardBodyStyle, inputStyle, rowStyle, toggleStyle, toggleKnobStyle } from './settingsStyles'

interface PermissionsSectionProps {
  permStatus: AllPermissions | null
  setPermStatus: (p: AllPermissions) => void
  showToast: (msg: string) => void
}

export default function PermissionsSection({ permStatus, setPermStatus, showToast }: PermissionsSectionProps) {
  const [permWakelock, setPermWakelock] = useState(getPermPref('wakelock', true))
  const [permBgsync, setPermBgsync] = useState(getPermPref('bgsync', false))
  const [permClipboard, setPermClipboard] = useState(getPermPref('clipboard', true))

  // Notification preferences
  const [notifPerms, setNotifPerms] = useState<{ show: boolean; reviewReminders: boolean; streakAlerts: boolean; pomodoroAlerts: boolean; reminderTime: string }>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('nousai-notif-prefs') || '{}');
      return { show: true, reviewReminders: true, streakAlerts: true, pomodoroAlerts: false, reminderTime: '09:00', ...stored };
    } catch { return { show: true, reviewReminders: true, streakAlerts: true, pomodoroAlerts: false, reminderTime: '09:00' }; }
  })

  const [fcmToken, setFcmToken] = useState(() => getFCMToken())
  const [vapidKey, setVapidKey] = useState(() => localStorage.getItem('nousai-fcm-vapid') || '')

  function PermBadge({ status }: { status: 'granted' | 'denied' | 'notyet' | 'na' }) {
    const map = {
      granted: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', text: 'Granted' },
      denied:  { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', text: 'Denied' },
      notyet:  { bg: 'rgba(234,179,8,0.12)', color: '#eab308', text: 'Not Yet' },
      na:      { bg: 'rgba(136,136,136,0.12)', color: '#888', text: 'N/A' },
    }
    const s = map[status]
    return (
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.color }}>
        {s.text}
      </span>
    )
  }

  return (
    <div style={cardBodyStyle}>
      {/* Notifications */}
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Notifications</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Timer alerts & review reminders</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PermBadge status={permStatus?.notification === 'granted' ? 'granted' : permStatus?.notification === 'denied' ? 'denied' : permStatus?.notification === 'unsupported' ? 'na' : 'notyet'} />
          {permStatus?.notification === 'prompt' && (
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={async () => {
              const r = await Notification.requestPermission()
              setPermStatus(await checkAllPermissions())
              if (r === 'granted') showToast('Notifications enabled')
            }}>Enable</button>
          )}
        </div>
      </div>

      {/* Notification Preferences */}
      {notifPerms.show && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>Notification Preferences</div>
          {([
            { key: 'reviewReminders' as const, label: 'Daily review reminders', desc: 'Remind when flashcards are due' },
            { key: 'streakAlerts' as const, label: 'Streak break alerts', desc: 'Alert when streak is at risk' },
            { key: 'pomodoroAlerts' as const, label: 'Pomodoro complete', desc: 'Notify when each session ends' },
          ] as const).map(({ key, label, desc }) => (
            <div key={key} style={rowStyle}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
              </div>
              <button style={toggleStyle(notifPerms[key])} onClick={() => setNotifPerms(p => ({ ...p, [key]: !p[key] }))}>
                <div style={toggleKnobStyle(notifPerms[key])} />
              </button>
            </div>
          ))}
          <div style={{ ...rowStyle, marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Reminder time</div>
            <input type="time" value={notifPerms.reminderTime} onChange={e => setNotifPerms(p => ({ ...p, reminderTime: e.target.value }))}
              style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
            />
          </div>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }}
            onClick={() => { localStorage.setItem('nousai-notif-prefs', JSON.stringify(notifPerms)); showToast('Notification preferences saved'); }}>
            Save
          </button>
        </div>
      )}

      {/* FCM Push Notifications */}
      {isFCMSupported() && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Push Notifications (FCM)</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
            Get real push notifications on your device — even when the app is closed.
            Requires a free Firebase VAPID key from your Firebase project console.
          </div>
          {!vapidKey && (
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Paste VAPID key (Firebase → Project Settings → Cloud Messaging)"
                value={vapidKey}
                onChange={e => { setVapidKey(e.target.value); localStorage.setItem('nousai-fcm-vapid', e.target.value); }}
                style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 11 }}
              />
            </div>
          )}
          {fcmToken ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--green, #22c55e)', fontWeight: 600 }}>✓ Push notifications active</span>
              <button className="btn btn-sm btn-secondary" onClick={() => { clearFCMToken(); setFcmToken(null); showToast('Push notifications disabled'); }}>Disable</button>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              disabled={!vapidKey}
              onClick={async () => {
                const result = await requestFCMPermission(vapidKey);
                if (result.token) { setFcmToken(result.token); showToast('Push notifications enabled!'); }
                else showToast(result.error || 'Failed to enable push notifications');
              }}
            >Enable Push Notifications</button>
          )}
        </div>
      )}

      {/* Microphone */}
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mic size={16} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Microphone</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Speech-to-text dictation</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PermBadge status={permStatus?.microphone === 'granted' ? 'granted' : permStatus?.microphone === 'denied' ? 'denied' : permStatus?.microphone === 'unsupported' ? 'na' : 'notyet'} />
          {permStatus?.microphone === 'prompt' && (
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={async () => {
              const r = await requestMicrophone()
              setPermStatus(await checkAllPermissions())
              if (r.granted) showToast('Microphone access granted')
              else if (r.error) showToast(r.error)
            }}>Enable</button>
          )}
        </div>
      </div>

      {/* Screen Wake Lock */}
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sun size={16} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Screen Wake Lock</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keep screen on during timer</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PermBadge status={!isWakeLockSupported() ? 'na' : permWakelock ? 'granted' : 'notyet'} />
          {isWakeLockSupported() && (
            <button
              style={toggleStyle(permWakelock)}
              onClick={() => { const v = !permWakelock; setPermWakelock(v); setPermPref('wakelock', v) }}
            >
              <div style={toggleKnobStyle(permWakelock)} />
            </button>
          )}
        </div>
      </div>

      {/* Persistent Storage */}
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HardDrive size={16} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Persistent Storage</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prevent browser from clearing data</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PermBadge status={!isPersistentStorageSupported() ? 'na' : permStatus?.persistentStorage === true ? 'granted' : 'notyet'} />
          {isPersistentStorageSupported() && permStatus?.persistentStorage !== true && (
            <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={async () => {
              const r = await requestPersistentStorage()
              setPermStatus(await checkAllPermissions())
              showToast(r.granted ? 'Storage persisted' : r.error || 'Not granted')
            }}>Request</button>
          )}
        </div>
      </div>

      {/* Background Sync */}
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Wifi size={16} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Background Sync</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sync data when back online</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PermBadge status={!isBackgroundSyncSupported() ? 'na' : permBgsync ? 'granted' : 'notyet'} />
          {isBackgroundSyncSupported() && (
            <button
              style={toggleStyle(permBgsync)}
              onClick={async () => {
                const v = !permBgsync
                setPermBgsync(v)
                setPermPref('bgsync', v)
                if (v) {
                  const r = await registerBackgroundSync()
                  if (!r.granted) showToast(r.error || 'Sync registration failed')
                  else showToast('Background sync enabled')
                }
              }}
            >
              <div style={toggleKnobStyle(permBgsync)} />
            </button>
          )}
        </div>
      </div>

      {/* Clipboard */}
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clipboard size={16} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Clipboard Access</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Copy/paste flashcards & notes</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PermBadge status={!isClipboardSupported() ? 'na' : permClipboard ? 'granted' : 'notyet'} />
          {isClipboardSupported() && (
            <button
              style={toggleStyle(permClipboard)}
              onClick={() => { const v = !permClipboard; setPermClipboard(v); setPermPref('clipboard', v) }}
            >
              <div style={toggleKnobStyle(permClipboard)} />
            </button>
          )}
        </div>
      </div>

      {/* File System Access */}
      <div style={{ ...rowStyle, borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>File System Access</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Import/export study materials</div>
          </div>
        </div>
        <PermBadge status={isFileSystemAccessSupported() ? 'granted' : 'na'} />
      </div>
    </div>
  )
}
