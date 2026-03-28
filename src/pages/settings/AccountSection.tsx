import { useState } from 'react'
import {
  Upload, Download, RefreshCw, ChevronDown, ChevronRight, Cloud,
  Key, Shield, Clock, LogOut, LogIn, UserPlus, Check,
  AlertTriangle, HardDrive
} from 'lucide-react'
import { signUp, signIn, logOut, signInWithGoogle, signInAsGuest, sendVerificationEmail, deleteAccount, saveFirebaseConfig, getFirebaseConfig } from '../../utils/auth'
import type { AuthUser } from '../../utils/auth'
import type { NousAIData } from '../../types'
import { cardBodyStyle, inputStyle, fieldGroupStyle, labelStyle, tabStyle, warningBoxStyle } from './settingsStyles'

interface AccountSectionProps {
  authUser: AuthUser | null
  authLoading: boolean
  data: NousAIData | null
  updatePluginData: (patch: Record<string, unknown>) => void
  showToast: (msg: string) => void
  triggerSyncToCloud: () => void
  triggerSyncFromCloud: () => void
  startRemoteWatch: (uid: string) => void
}

export default function AccountSection({
  authUser, authLoading, data, updatePluginData, showToast,
  triggerSyncToCloud, triggerSyncFromCloud,
}: AccountSectionProps) {
  // Auth form state
  const [authTab, setAuthTab] = useState<'signin' | 'create'>('signin')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Sign in form
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  // Create account form
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createConfirm, setCreateConfirm] = useState('')

  // Sync state
  const [lastSync] = useState<string | null>(localStorage.getItem('nousai-last-sync'))

  // Custom Firebase config state
  const [showCustomFb, setShowCustomFb] = useState(false)
  const [customFbConfig, setCustomFbConfig] = useState(() => {
    const cfg = getFirebaseConfig()
    return {
      apiKey: localStorage.getItem('nousai-fb-apiKey') || '',
      authDomain: localStorage.getItem('nousai-fb-authDomain') || '',
      projectId: localStorage.getItem('nousai-fb-projectId') || '',
      storageBucket: localStorage.getItem('nousai-fb-storageBucket') || '',
      messagingSenderId: localStorage.getItem('nousai-fb-messagingSenderId') || '',
      appId: localStorage.getItem('nousai-fb-appId') || '',
    }
  })
  const isCustomFb = !!localStorage.getItem('nousai-fb-apiKey')

  // Profile customization
  const [profileDraft, setProfileDraft] = useState<{ avatarEmoji?: string; customDisplayName?: string; bio?: string }>(() => data?.pluginData?.userProfile ?? {})

  async function handleSignIn() {
    if (!signInEmail || !signInPassword) {
      setAuthError('Please enter your email and password.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    try {
      const authResult = await signIn(signInEmail, signInPassword)
      if (authResult?.uid) localStorage.setItem('nousai-auth-uid', authResult.uid)
      showToast('Signed in successfully!')
      setSignInEmail('')
      setSignInPassword('')
      const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : /iPad|Tablet/i.test(navigator.userAgent) ? 'Tablet' : 'Desktop'
      const existing = data?.pluginData?.loginHistory ?? []
      updatePluginData({ loginHistory: [...existing.slice(-9), { timestamp: new Date().toISOString(), device: deviceType }] })
    } catch (e: any) {
      const msg = e?.message || 'Sign in failed.'
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setAuthError('Invalid email or password.')
      } else if (msg.includes('invalid-email')) {
        setAuthError('Invalid email address.')
      } else if (msg.includes('too-many-requests')) {
        setAuthError('Too many attempts. Please try again later.')
      } else {
        setAuthError(msg)
      }
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleCreateAccount() {
    if (!createEmail || !createPassword) {
      setAuthError('Please fill in all required fields.')
      return
    }
    if (createPassword !== createConfirm) {
      setAuthError('Passwords do not match.')
      return
    }
    if (createPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    try {
      await signUp(createEmail, createPassword, createName || undefined)
      showToast('Account created successfully!')
      setCreateName('')
      setCreateEmail('')
      setCreatePassword('')
      setCreateConfirm('')
    } catch (e: any) {
      const msg = e?.message || 'Account creation failed.'
      if (msg.includes('email-already-in-use')) {
        setAuthError('An account with this email already exists.')
      } else if (msg.includes('invalid-email')) {
        setAuthError('Invalid email address.')
      } else if (msg.includes('weak-password')) {
        setAuthError('Password is too weak. Use at least 6 characters.')
      } else {
        setAuthError(msg)
      }
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogOut() {
    try {
      await logOut()
      localStorage.removeItem('nousai-auth-uid')
      showToast('Signed out.')
    } catch {
      showToast('Failed to sign out.')
    }
  }

  return (
    <div style={cardBodyStyle}>
      {authLoading ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 13, marginTop: 8 }}>Loading account...</p>
        </div>
      ) : authUser ? (
        /* ── Logged In View ── */
        <div>
          {/* User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--accent, #666)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--bg-primary)', fontWeight: 700, fontSize: 18, flexShrink: 0,
            }}>
              {(authUser.displayName || authUser.email)?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {authUser.displayName && (
                <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {authUser.displayName}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {authUser.email}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                UID: {authUser.uid.slice(0, 12)}...
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              {authUser.emailVerified ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={14} style={{ color: 'var(--green, #22c55e)' }} />
                  <span style={{ fontSize: 11, color: 'var(--green, #22c55e)', fontWeight: 600 }}>Verified</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={14} style={{ color: '#eab308' }} />
                  <span style={{ fontSize: 11, color: '#eab308', fontWeight: 600 }}>Unverified</span>
                </div>
              )}
              {!authUser.emailVerified && (
                <button className="btn btn-sm btn-secondary" onClick={async () => {
                  try { await sendVerificationEmail(); showToast('Verification email sent — check your inbox'); }
                  catch { showToast('Failed to send verification email'); }
                }}>Verify Email</button>
              )}
            </div>
          </div>

          {/* ── Customize Profile ── */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>Customize Profile</div>
            {/* Avatar emoji picker */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Avatar</div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {['🧠','📚','🎯','⚡','🔥','🌟','💡','🏆','🎓','✨'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setProfileDraft(p => ({ ...p, avatarEmoji: emoji }))}
                    style={{
                      fontSize: 20, padding: '4px 6px', borderRadius: 8, cursor: 'pointer', border: '2px solid',
                      borderColor: profileDraft.avatarEmoji === emoji ? 'var(--accent)' : 'transparent',
                      background: profileDraft.avatarEmoji === emoji ? 'var(--accent-dim)' : 'transparent',
                    }}
                  >{emoji}</button>
                ))}
              </div>
            </div>
            {/* Display name */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Display Name</div>
              <input
                type="text"
                value={profileDraft.customDisplayName ?? ''}
                onChange={e => setProfileDraft(p => ({ ...p, customDisplayName: e.target.value }))}
                placeholder={authUser?.displayName || 'Your name'}
                maxLength={40}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>
            {/* Bio */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Bio / tagline</div>
              <input
                type="text"
                value={profileDraft.bio ?? ''}
                onChange={e => setProfileDraft(p => ({ ...p, bio: e.target.value }))}
                placeholder="e.g. Med student · Tokyo · 🍵"
                maxLength={80}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const trimmed = {
                  ...profileDraft,
                  customDisplayName: profileDraft.customDisplayName?.trim() || undefined,
                  bio: profileDraft.bio?.trim() || undefined,
                };
                updatePluginData({ userProfile: trimmed });
                showToast('Profile saved');
              }}
            >Save Profile</button>
          </div>

          {/* Last sync */}
          {lastSync && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={12} />
              Last synced: {new Date(lastSync).toLocaleString()}
            </div>
          )}

          {/* Sync info */}
          <div style={{ ...warningBoxStyle, background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.15)' }}>
            <Cloud size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent, #3b82f6)' }} />
            <span>Your data syncs automatically to the cloud. Access your study progress, quizzes, and flashcards from any device by signing in.</span>
          </div>

          {/* ── Login History ── */}
          {(data?.pluginData?.loginHistory ?? []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>Recent logins</div>
              {(data!.pluginData!.loginHistory!).slice(-5).reverse().map((entry, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{entry.device}</span>
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Custom Firebase Config (Advanced) */}
          <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}
              onClick={() => setShowCustomFb(!showCustomFb)}
            >
              {showCustomFb ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <HardDrive size={13} />
              <span style={{ fontWeight: 600 }}>Advanced: Use Your Own Firebase</span>
              {isCustomFb && <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.15)', color: 'var(--green, #22c55e)', padding: '1px 6px', borderRadius: 8 }}>Active</span>}
            </div>
            {showCustomFb && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  Optional — create your own Firebase project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>console.firebase.google.com</a> for independent storage. Enable Email/Password auth, create Firestore & Storage.
                </div>
                {(['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const).map(field => (
                  <div key={field} style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{field}</label>
                    <input
                      type="text"
                      style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }}
                      placeholder={field}
                      value={customFbConfig[field]}
                      onChange={e => setCustomFbConfig(prev => ({ ...prev, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      if (!customFbConfig.apiKey || !customFbConfig.projectId) {
                        showToast('At minimum, enter API Key and Project ID.')
                        return
                      }
                      saveFirebaseConfig(customFbConfig)
                    }}
                  >
                    <Check size={13} /> Save & Restart
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].forEach(k => localStorage.removeItem(`nousai-fb-${k}`))
                      showToast('Reset to default Firebase. Reloading...')
                      setTimeout(() => window.location.reload(), 500)
                    }}
                  >
                    Reset to Default
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cloud Sync */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => triggerSyncToCloud()}>
              <Upload size={14} /> Sync to Cloud
            </button>
            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => triggerSyncFromCloud()}>
              <Download size={14} /> Sync from Cloud
            </button>
          </div>

          {/* Sign out */}
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 16, color: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)' }}
            onClick={handleLogOut}
          >
            <LogOut size={14} /> Sign Out
          </button>

          {/* ── Danger Zone ── */}
          <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red, #ef4444)', marginBottom: 8 }}>Danger Zone</div>
            {!showDeleteConfirm ? (
              <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red, #ef4444)', border: '1px solid rgba(239,68,68,0.3)' }}
                onClick={() => setShowDeleteConfirm(true)}>
                Delete Account
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Type DELETE to confirm account deletion. This cannot be undone.</div>
                <input type="text" placeholder="Type DELETE" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--red, #ef4444)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, marginBottom: 8 }} />
                <div className="flex gap-2">
                  <button className="btn btn-sm btn-secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>Cancel</button>
                  <button
                    className="btn btn-sm"
                    style={{ background: deleteConfirmText === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,0.3)', color: 'white' }}
                    disabled={deleteConfirmText !== 'DELETE'}
                    onClick={async () => {
                      const result = await deleteAccount();
                      if (result.error) { showToast(result.error); return; }
                      Object.keys(localStorage).forEach(k => { if (k.startsWith('nousai')) localStorage.removeItem(k); });
                      showToast('Account deleted');
                      window.location.reload();
                    }}>
                    Delete My Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Not Logged In View ── */
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <button style={tabStyle(authTab === 'signin')} onClick={() => { setAuthTab('signin'); setAuthError(null) }}>
              <LogIn size={14} /> Sign In
            </button>
            <button style={tabStyle(authTab === 'create')} onClick={() => { setAuthTab('create'); setAuthError(null) }}>
              <UserPlus size={14} /> Create Account
            </button>
          </div>

          {/* Error display */}
          {authError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 14,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 'var(--radius-sm)', color: 'var(--red, #ef4444)', fontSize: 13,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              {authError}
            </div>
          )}

          {/* Google OAuth */}
          <button
            className="btn btn-secondary"
            style={{ width: '100%', marginBottom: 12, gap: 8, justifyContent: 'center' }}
            onClick={async () => {
              const result = await signInWithGoogle();
              if (result.error) showToast(result.error);
              else showToast('Signed in with Google!');
            }}
          >
            <span style={{ fontSize: 16 }}>G</span> Continue with Google
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>— or —</div>

          {authTab === 'signin' ? (
            /* ── Sign In Form ── */
            <div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  style={inputStyle}
                  value={signInEmail}
                  onChange={e => setSignInEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  autoComplete="email"
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  placeholder="Enter your password"
                  style={inputStyle}
                  value={signInPassword}
                  onChange={e => setSignInPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                  autoComplete="current-password"
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', opacity: authBusy ? 0.6 : 1 }}
                disabled={authBusy}
                onClick={handleSignIn}
              >
                {authBusy ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</> : <><LogIn size={15} /> Sign In</>}
              </button>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button className="btn btn-sm btn-secondary" style={{ width: '100%' }}
                  onClick={async () => {
                    const result = await signInAsGuest();
                    if (result.error) showToast(result.error);
                    else showToast('Signed in as guest. Your data is stored locally.');
                  }}>
                  Continue as Guest
                </button>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Guest data is local only — sign up to sync across devices</div>
              </div>
            </div>
          ) : (
            /* ── Create Account Form ── */
            <div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Display Name</label>
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  style={inputStyle}
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  style={inputStyle}
                  value={createEmail}
                  onChange={e => setCreateEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  style={inputStyle}
                  value={createPassword}
                  onChange={e => setCreatePassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Confirm Password</label>
                <input
                  type="password"
                  placeholder="Re-enter your password"
                  style={inputStyle}
                  value={createConfirm}
                  onChange={e => setCreateConfirm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateAccount()}
                  autoComplete="new-password"
                />
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', opacity: authBusy ? 0.6 : 1 }}
                disabled={authBusy}
                onClick={handleCreateAccount}
              >
                {authBusy ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : <><UserPlus size={15} /> Create Account</>}
              </button>
            </div>
          )}

          {/* Info box */}
          <div style={{ ...warningBoxStyle, background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.15)' }}>
            <Cloud size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent, #3b82f6)' }} />
            <span>Your account syncs your data to the cloud. Sign in on any device to access your study progress, quizzes, flashcards, and more.</span>
          </div>
        </div>
      )}
    </div>
  )
}
