import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Lock, LogOut, Eye, EyeOff, CheckCircle, AlertTriangle, User, Mail, Shield } from 'lucide-react'
import { updatePassword } from '../services/supabase'
import { AvatarInitials } from './AvatarInitials'

const ROLE_COLOR_FALLBACK = { bg: '#F3F4F6', text: '#374151' }

function RolePill({ role, appRoles = [] }) {
  const found = appRoles.find(r => r.name === role)
  const c = found ? { bg: found.color_bg, text: found.color_text } : ROLE_COLOR_FALLBACK
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: c.bg, color: c.text, letterSpacing: '0.04em',
    }}>{role}</span>
  )
}

function PasswordInput({ value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '9px 38px 9px 12px',
          border: '1.5px solid #E5E7EB', borderRadius: 8,
          fontSize: 13.5, fontFamily: 'Inter, sans-serif',
          color: '#111', outline: 'none', transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.target.style.borderColor = '#D4AF37' }}
        onBlur={e => { e.target.style.borderColor = '#E5E7EB' }}
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9CA3AF',
          display: 'flex', alignItems: 'center',
        }}
        tabIndex={-1}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

function PasswordStrength({ password }) {
  if (!password) return null
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Contains uppercase', ok: /[A-Z]/.test(password) },
    { label: 'Contains number', ok: /\d/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const colors = ['#EF4444', '#F59E0B', '#10B981']
  const labels = ['Weak', 'Fair', 'Strong']

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < score ? colors[score - 1] : '#E5E7EB',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: score > 0 ? colors[score - 1] : '#9CA3AF', fontWeight: 600, marginBottom: 6 }}>
        {score > 0 ? labels[score - 1] : ''}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {checks.map(c => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: c.ok ? '#059669' : '#9CA3AF' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.ok ? '#D1FAE5' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {c.ok && <CheckCircle size={10} color="#059669" />}
            </div>
            {c.label}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProfileSettingsModal({ isOpen, onClose, currentUser, onSignOut }) {
  const [tab, setTab] = useState('profile') // 'profile' | 'password'
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setTab('profile')
      setNewPassword('')
      setConfirmPassword('')
      setError(null)
      setSuccess(false)
      setShowLogoutConfirm(false)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleChangePassword = useCallback(async () => {
    setError(null)
    if (!newPassword) { setError('Please enter a new password.'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }

    setIsSubmitting(true)
    try {
      await updatePassword(newPassword)
      setSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [newPassword, confirmPassword])

  if (!isOpen) return null

  const tabStyle = (active) => ({
    flex: 1, padding: '9px 0', fontSize: 12.5, fontWeight: active ? 600 : 500,
    color: active ? '#111' : '#6B7280', border: 'none', background: 'none',
    cursor: 'pointer', borderBottom: active ? '2px solid #D4AF37' : '2px solid transparent',
    transition: 'all 0.15s',
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', fontFamily: 'Inter, sans-serif' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', width: 420, maxWidth: 'calc(100vw - 32px)', overflow: 'hidden', animation: 'modal-in 0.18s ease' }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes modal-in{from{opacity:0;transform:scale(.96) translateY(6px)}to{opacity:1;transform:none}}`}</style>

        {/* Header */}
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F1F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>Account Settings</div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8F9FB'; e.currentTarget.style.color = '#111' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F3' }}>
          <button style={tabStyle(tab === 'profile')} onClick={() => setTab('profile')}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <User size={13} /> Profile
            </span>
          </button>
          <button style={tabStyle(tab === 'password')} onClick={() => setTab('password')}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Lock size={13} /> Change Password
            </span>
          </button>
        </div>

        {/* Tab: Profile */}
        {tab === 'profile' && (
          <div style={{ padding: 24 }}>
            {/* Avatar + name */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <AvatarInitials name={currentUser?.name} color={currentUser?.color} size={64} />
              <div style={{ marginTop: 12, fontSize: 17, fontWeight: 700, color: '#111' }}>{currentUser?.name}</div>
              <div style={{ marginTop: 6 }}><RolePill role={currentUser?.role} appRoles={currentUser?.appRoles || []} /></div>
            </div>

            {/* Info fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: Mail, label: 'Email', value: currentUser?.email },
                { icon: Shield, label: 'Role', value: currentUser?.role },
                { icon: User, label: 'Department', value: currentUser?.department || '—' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', background: '#F8F9FB', borderRadius: 9, border: '1px solid #F0F1F3' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} color="#6B7280" />
                  </div>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Logout button */}
            <div style={{ marginTop: 24, borderTop: '1px solid #F0F1F3', paddingTop: 18 }}>
              {!showLogoutConfirm ? (
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  style={{
                    width: '100%', padding: '9px 14px', borderRadius: 8,
                    border: '1.5px solid #FEE2E2', background: '#FFF5F5',
                    color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#FFF5F5' }}
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              ) : (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111', marginBottom: 4 }}>Sign out of Glory8 Mailbox?</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>You'll need to sign in again to access your messages.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setShowLogoutConfirm(false)}
                      style={{ flex: 1, padding: '8px', border: '1px solid #E5E7EB', borderRadius: 7, background: '#fff', fontSize: 12.5, fontWeight: 500, color: '#374151', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={onSignOut}
                      style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 7, background: '#DC2626', fontSize: 12.5, fontWeight: 600, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                    >
                      <LogOut size={13} />
                      Yes, Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Change Password */}
        {tab === 'password' && (
          <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
                Choose a strong password. After changing, you'll stay logged in on this device.
              </p>
            </div>

            {/* Success banner */}
            {success && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#065F46', fontWeight: 500 }}>
                <CheckCircle size={15} color="#059669" />
                Password updated successfully!
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, marginBottom: 16, fontSize: 12.5, color: '#DC2626' }}>
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  New Password
                </label>
                <PasswordInput
                  id="new-password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError(null); setSuccess(false) }}
                  placeholder="Enter new password"
                />
                <PasswordStrength password={newPassword} />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Confirm New Password
                </label>
                <PasswordInput
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(null) }}
                  placeholder="Re-enter new password"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <div style={{ fontSize: 11.5, color: '#DC2626', marginTop: 5 }}>Passwords do not match</div>
                )}
                {confirmPassword && newPassword === confirmPassword && confirmPassword.length > 0 && (
                  <div style={{ fontSize: 11.5, color: '#059669', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={11} /> Passwords match
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleChangePassword}
              disabled={isSubmitting || !newPassword || !confirmPassword}
              style={{
                width: '100%', marginTop: 22, padding: '10px 14px', borderRadius: 8, border: 'none',
                background: (isSubmitting || !newPassword || !confirmPassword) ? '#E5E7EB' : '#D4AF37',
                color: (isSubmitting || !newPassword || !confirmPassword) ? '#9CA3AF' : '#111',
                fontSize: 13.5, fontWeight: 600,
                cursor: (isSubmitting || !newPassword || !confirmPassword) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'background 0.15s',
              }}
            >
              <Lock size={14} />
              {isSubmitting ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
