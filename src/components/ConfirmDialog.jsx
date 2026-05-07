import { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2, Archive, RotateCcw, X } from 'lucide-react'

const VARIANTS = {
  delete: {
    icon: <Trash2 size={20} strokeWidth={1.75} />,
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    confirmBg: '#DC2626',
    confirmHover: '#B91C1C',
    confirmColor: '#fff',
  },
  permDelete: {
    icon: <Trash2 size={20} strokeWidth={1.75} />,
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    confirmBg: '#DC2626',
    confirmHover: '#B91C1C',
    confirmColor: '#fff',
  },
  archive: {
    icon: <Archive size={20} strokeWidth={1.75} />,
    iconBg: '#EFF6FF',
    iconColor: '#2563EB',
    confirmBg: '#2563EB',
    confirmHover: '#1D4ED8',
    confirmColor: '#fff',
  },
  restore: {
    icon: <RotateCcw size={20} strokeWidth={1.75} />,
    iconBg: '#F0FDF4',
    iconColor: '#16A34A',
    confirmBg: '#16A34A',
    confirmHover: '#15803D',
    confirmColor: '#fff',
  },
  warn: {
    icon: <AlertTriangle size={20} strokeWidth={1.75} />,
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
    confirmBg: '#D97706',
    confirmHover: '#B45309',
    confirmColor: '#fff',
  },
}

/**
 * ConfirmDialog — minimal, accessible confirmation modal.
 *
 * Props:
 *   open       {boolean}   — whether to show
 *   variant    {string}    — 'delete' | 'permDelete' | 'archive' | 'restore' | 'warn'
 *   title      {string}    — headline text
 *   message    {string}    — body description
 *   confirmLabel {string}  — confirm button text (default 'Confirm')
 *   onConfirm  {fn}        — called when user clicks confirm
 *   onCancel   {fn}        — called when user clicks cancel or closes
 */
export function ConfirmDialog({
  open,
  variant = 'warn',
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null)
  const v = VARIANTS[variant] || VARIANTS.warn

  // Focus confirm button when dialog opens
  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 50)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 2000, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 2001,
          background: '#fff', borderRadius: 14,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          width: 380, maxWidth: 'calc(100vw - 32px)',
          fontFamily: 'Inter, sans-serif',
          padding: '24px 24px 20px',
          animation: 'confirmIn 0.18s ease',
        }}
      >
        {/* Close × */}
        <button
          onClick={onCancel}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28, border: 'none', background: 'none',
            cursor: 'pointer', borderRadius: 6, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#9CA3AF',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9CA3AF' }}
        >
          <X size={15} />
        </button>

        {/* Icon + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: v.iconBg, color: v.iconColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {v.icon}
          </div>
          <h2 id="confirm-title" style={{
            margin: 0, fontSize: 15, fontWeight: 700, color: '#111', lineHeight: 1.3,
          }}>
            {title}
          </h2>
        </div>

        {/* Message */}
        {message && (
          <p style={{
            margin: '0 0 20px', fontSize: 13.5, color: '#6B7280', lineHeight: 1.6,
          }}>
            {message}
          </p>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 7,
              border: '1px solid #E5E7EB', background: 'transparent',
              fontSize: 13, fontWeight: 500, color: '#374151', cursor: 'pointer',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 7,
              border: 'none', background: v.confirmBg,
              fontSize: 13, fontWeight: 600, color: v.confirmColor,
              cursor: 'pointer', transition: 'background 0.12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = v.confirmHover}
            onMouseLeave={e => e.currentTarget.style.background = v.confirmBg}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confirmIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  )
}
