import { useState, useEffect, useCallback } from 'react'
import { X, AlertTriangle, Mail } from 'lucide-react'

const AUTO_DISMISS_MS = 6000

/**
 * Animated toast notification for incoming messages.
 * Props:
 *   notification: { id, senderName, subject, isPriority }
 *   onView()     – called when user clicks "View"
 *   onDismiss()  – called when dismissed or auto-expired
 */
export function NotificationToast({ notification, onView, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20)
    return () => clearTimeout(t)
  }, [])

  // Auto-dismiss
  useEffect(() => {
    const t = setTimeout(() => dismiss(), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dismiss = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onDismiss(), 280)
  }, [onDismiss])

  const handleView = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onView(), 200)
  }, [onView])

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: none; }
          to   { opacity: 0; transform: translateY(10px) scale(0.95); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
          width: 340, maxWidth: 'calc(100vw - 32px)',
          background: '#fff',
          border: notification?.isPriority
            ? '1.5px solid #FCD34D'
            : '1px solid rgba(0,0,0,0.09)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          overflow: 'hidden',
          animation: leaving
            ? 'toast-out 0.28s ease forwards'
            : visible ? 'toast-in 0.25s ease forwards' : 'none',
          opacity: visible ? 1 : 0,
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Priority stripe */}
        {notification?.isPriority && (
          <div style={{ height: 3, background: 'linear-gradient(90deg,#F59E0B,#D97706)', width: '100%' }} />
        )}

        <div style={{ padding: '14px 14px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {/* Icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: notification?.isPriority ? '#FEF3C7' : '#F0F9FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {notification?.isPriority
                ? <AlertTriangle size={16} color="#D97706" />
                : <Mail size={16} color="#0EA5E9" />
              }
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {notification?.isPriority && (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '1px 5px', borderRadius: 4 }}>URGENT</span>
                  )}
                  New message
                </div>
                <button
                  onClick={dismiss}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4, color: '#9CA3AF', display: 'flex' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9CA3AF' }}
                >
                  <X size={13} />
                </button>
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: '#111', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {notification?.senderName || 'Someone'}
              </div>
              <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {notification?.subject || '(no subject)'}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              onClick={handleView}
              style={{
                flex: 1, padding: '6px 0', background: '#D4AF37',
                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                color: '#111', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#B8962E' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#D4AF37' }}
            >
              View
            </button>
            <button
              onClick={dismiss}
              style={{
                flex: 1, padding: '6px 0', background: '#F3F4F6',
                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500,
                color: '#374151', cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#E5E7EB' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#F3F4F6' }}
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Progress bar (auto-dismiss timer) */}
        <div style={{ height: 2, background: '#F0F1F3' }}>
          <div style={{
            height: '100%', background: '#D4AF37',
            animation: `progress-drain ${AUTO_DISMISS_MS}ms linear forwards`,
          }} />
        </div>
        <style>{`
          @keyframes progress-drain {
            from { width: 100%; }
            to   { width: 0%; }
          }
        `}</style>
      </div>
    </>
  )
}
