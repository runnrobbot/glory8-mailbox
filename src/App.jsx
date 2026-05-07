// src/App.jsx
import { useState, useEffect } from 'react'
import { getSession, getProfile, signIn, signOut, fetchAppRoles, fetchAppLabels } from './services/supabase'
import { buildPermissions } from './utils/rbac'
import { MailboxPage } from './pages/MailboxPage'

// ─── Simple inline login screen ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      onLogin()
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F9FB', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16,
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
        width: 400, maxWidth: '95vw', padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg,#D4AF37 0%,#B8962E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, color: '#111', letterSpacing: '-0.02em',
          }}>G8</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Glory8 Mailbox</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>Internal communications</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@glory8.com"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13.5,
                fontFamily: 'Inter, sans-serif', color: '#111', outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#D4AF37' }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB' }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '9px 12px',
                border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13.5,
                fontFamily: 'Inter, sans-serif', color: '#111', outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#D4AF37' }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB' }}
            />
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 7, padding: '8px 12px', marginBottom: 14,
              fontSize: 12.5, color: '#DC2626',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, border: 'none',
              background: loading ? '#E5E7EB' : '#D4AF37',
              color: loading ? '#9CA3AF' : '#111',
              fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Full-screen loading skeleton ────────────────────────────────────────────
function AppLoader() {
  return (
    <div style={{
      minHeight: '100vh', background: '#F8F9FB',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'linear-gradient(135deg,#D4AF37 0%,#B8962E 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: '#111', margin: '0 auto 16px',
          animation: 'pulse-logo 1.5s ease-in-out infinite',
        }}>G8</div>
        <div style={{ fontSize: 12.5, color: '#9CA3AF' }}>Loading…</div>
      </div>
      <style>{`
        @keyframes pulse-logo {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.75; transform: scale(0.95); }
        }
      `}</style>
    </div>
  )
}

// ─── Root App ────────────────────────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'authenticated' | 'unauthenticated'
  const [currentUser, setCurrentUser] = useState(null)

  const loadUser = async () => {
    try {
      const session = await getSession()
      if (!session) {
        setAuthState('unauthenticated')
        return
      }
      const [profile, appRoles, appLabels] = await Promise.all([
        getProfile(session.user.id),
        fetchAppRoles(),
        fetchAppLabels(),
      ])
      const userAppRole = appRoles.find(r => r.name === profile.role) || null
      const permissions = buildPermissions(userAppRole)
      setCurrentUser({ ...session.user, ...profile, permissions, appRoles, appLabels })
      setAuthState('authenticated')
    } catch {
      setAuthState('unauthenticated')
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  if (authState === 'loading') return <AppLoader />
  if (authState === 'unauthenticated') return <LoginScreen onLogin={loadUser} />

  return (
    <MailboxPage
      currentUser={currentUser}
      onSignOut={async () => {
        await signOut()
        setCurrentUser(null)
        setAuthState('unauthenticated')
      }}
    />
  )
}
