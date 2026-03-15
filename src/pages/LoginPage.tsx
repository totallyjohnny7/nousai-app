/**
 * Login / Signup page for NousAI Companion
 */
import { useState } from 'react';
import { LogIn, UserPlus, Lock, Mail, User, Wifi, WifiOff, KeyRound } from 'lucide-react';
import { signIn, signUp, isFirebaseConfigured, hasLocalPin, checkLocalPin } from '../utils/auth';
import type { AuthUser } from '../utils/auth';

interface LoginPageProps {
  onAuth: (user: AuthUser | null) => void;
  onSkip: () => void;
}

export default function LoginPage({ onAuth, onSkip }: LoginPageProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'pin'>(() =>
    hasLocalPin() ? 'pin' : 'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cloudAvailable = isFirebaseConfigured();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'pin') {
        if (await checkLocalPin(pin)) {
          onAuth(null); // Local mode, no cloud user
        } else {
          setError('Incorrect PIN');
        }
      } else if (mode === 'login') {
        const user = await signIn(email, password);
        onAuth(user);
      } else {
        const user = await signUp(email, password, name || undefined);
        onAuth(user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-in" style={{ maxWidth: 400, margin: '0 auto', padding: '40px 20px' }}>
      {/* Logo */}
      <div className="text-center mb-4">
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 16,
        }}>N</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '8px 0' }}>NousAI</h1>
        <p className="text-sm text-muted">Study smarter, not harder</p>
      </div>

      {/* Mode tabs */}
      {cloudAvailable && (
        <div className="flex gap-2 mb-4">
          <button
            className={`btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('login')}
            style={{ flex: 1 }}
          >
            <LogIn size={14} /> Sign In
          </button>
          <button
            className={`btn btn-sm ${mode === 'signup' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode('signup')}
            style={{ flex: 1 }}
          >
            <UserPlus size={14} /> Sign Up
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="card">
          {mode === 'pin' ? (
            <>
              <div className="card-title mb-3">
                <KeyRound size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Enter PIN
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>PIN</label>
                <div className="flex items-center gap-2" style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, color: 'var(--text-muted)' }} />
                  <input
                    type="password" value={pin} onChange={e => setPin(e.target.value)}
                    placeholder="Enter your PIN"
                    style={{
                      width: '100%', padding: '10px 12px 10px 36px',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)',
                      fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="card-title mb-3">
                {cloudAvailable ? (
                  <><Wifi size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--green)' }} />Cloud Sync</>
                ) : (
                  <><WifiOff size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Local Mode</>
                )}
              </div>

              {mode === 'signup' && (
                <div style={{ marginBottom: 12 }}>
                  <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Display Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                    <input
                      type="text" value={name} onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      style={{
                        width: '100%', padding: '10px 12px 10px 36px',
                        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-input)', color: 'var(--text-primary)',
                        fontSize: 14, outline: 'none',
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" required
                    style={{
                      width: '100%', padding: '10px 12px 10px 36px',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)',
                      fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                  <input
                    type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required minLength={6}
                    style={{
                      width: '100%', padding: '10px 12px 10px 36px',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)',
                      fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div style={{
              padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
              background: 'var(--red-dim)', color: 'var(--red)', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Please wait...' : mode === 'pin' ? 'Unlock' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </form>

      {/* Skip / local mode */}
      <div className="text-center mt-3">
        <button
          onClick={onSkip}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 13, cursor: 'pointer', padding: '8px 16px',
            textDecoration: 'underline',
          }}
        >
          {hasLocalPin() ? 'Use without PIN' : 'Continue without account'}
        </button>
      </div>

      {/* Info */}
      {!cloudAvailable && (
        <div style={{
          marginTop: 24, padding: 16, borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-secondary)', fontSize: 12, color: 'var(--text-muted)',
        }}>
          <strong>💡 Want cloud sync?</strong><br />
          Set up Firebase in Settings → Cloud Sync to enable login, cloud backup, and sharing with friends.
        </div>
      )}
    </div>
  );
}
