import { useEffect } from 'react'
import { X } from 'lucide-react'

const SHORTCUTS = [
  {
    group: 'Navigation',
    items: [
      { keys: ['J'], description: 'Next message' },
      { keys: ['K'], description: 'Previous message' },
      { keys: ['Enter', '↵'], description: 'Open selected message' },
      { keys: ['Esc'], description: 'Close thread / modal' },
    ],
  },
  {
    group: 'Actions',
    items: [
      { keys: ['C'], description: 'Compose new message' },
      { keys: ['R'], description: 'Reply to message' },
      { keys: ['E'], description: 'Archive message' },
      { keys: ['#'], description: 'Move to trash' },
      { keys: ['S'], description: 'Toggle star' },
      { keys: ['U'], description: 'Mark as unread' },
    ],
  },
  {
    group: 'Folders',
    items: [
      { keys: ['G', 'I'], description: 'Go to Inbox' },
      { keys: ['G', 'S'], description: 'Go to Sent' },
      { keys: ['G', 'D'], description: 'Go to Drafts' },
      { keys: ['G', 'T'], description: 'Go to Trash' },
    ],
  },
  {
    group: 'General',
    items: [
      { keys: ['/'], description: 'Focus search' },
      { keys: ['?'], description: 'Toggle shortcuts' },
      { keys: ['Ctrl', 'Enter'], description: 'Send message' },
    ],
  },
]

export function ShortcutsModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(3px)',
        fontFamily: 'Inter, sans-serif',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff', borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
          width: 580, maxWidth: '95vw', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'shortcuts-in 0.18s ease',
        }}
      >
        <style>{`@keyframes shortcuts-in{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:none}}`}</style>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #F0F1F3',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>Keyboard Shortcuts</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>Navigate Glory8 Mailbox faster</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, border: 'none', background: 'transparent',
              cursor: 'pointer', borderRadius: 7, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#6B7280',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Shortcuts grid */}
        <div style={{ overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {SHORTCUTS.map((section) => (
            <div key={section.group}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                {section.group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {section.items.map((item) => (
                  <div key={item.description} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12.5, color: '#374151' }}>{item.description}</span>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: 22, height: 20, padding: '0 5px',
                            background: '#F3F4F6', border: '1px solid #E5E7EB',
                            borderRadius: 4, fontSize: 11, fontWeight: 600,
                            fontFamily: 'ui-monospace, monospace', color: '#374151',
                            boxShadow: '0 1px 0 #D1D5DB',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid #F0F1F3',
          background: '#F8F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>
            Press <kbd style={{ background: '#E5E7EB', border: '1px solid #D1D5DB', borderRadius: 3, padding: '1px 5px', fontSize: 10.5, fontFamily: 'monospace', color: '#374151' }}>?</kbd> anytime to toggle this panel
          </span>
        </div>
      </div>
    </div>
  )
}
