import { useState, useCallback, useRef, useEffect, memo } from 'react'
import {
  Star, Archive, Trash2, Eye, EyeOff,
  ArrowLeft, Paperclip, Send, Loader, ChevronRight,
} from 'lucide-react'
import { useMailbox } from '../context/MailboxContext'
import { sendMessage } from '../services/supabase'
import { AvatarInitials } from './AvatarInitials'
import { formatTime, formatFullDate } from '../utils/time'
import { sanitizeHtml } from '../utils/sanitize'
import { genIdempotencyKey } from '../utils/ids'
import { ConfirmDialog } from './ConfirmDialog'

// ── Empty state ───────────────────────────────────────────────
export function EmptyThreadPanel() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%',
      background: '#F8F9FB', fontFamily: 'Inter, sans-serif',
    }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.25"
        style={{ marginBottom: 14 }}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
        No message selected
      </h3>
      <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', maxWidth: 220, lineHeight: 1.6, margin: 0 }}>
        Select a message from the list to read it here
      </p>
    </div>
  )
}

// ── Normalize raw DB thread message ──────────────────────────
function normalizeThreadMsg(raw) {
  const sender = raw.profiles || {}
  return {
    id:           raw.id,
    fromName:     sender.name || sender.email || 'Unknown',
    fromInitials: sender.initials || (sender.name || 'U').slice(0, 2).toUpperCase(),
    fromRole:     sender.role || '',
    fromColor:    null,
    timestamp:    raw.created_at,
    body:         raw.body || '',
    preview:      (raw.body || '').replace(/<[^>]+>/g, '').slice(0, 120),
    attachments:  raw.attachments || [],
  }
}

// ── Single thread bubble ──────────────────────────────────────
const ThreadMessage = memo(function ThreadMessage({ msg, isLast }) {
  const [expanded, setExpanded] = useState(isLast)

  // Always expand the last bubble when it changes
  useEffect(() => { if (isLast) setExpanded(true) }, [isLast, msg.id])

  return (
    <div
      onClick={() => !isLast && setExpanded(v => !v)}
      style={{
        border: '1px solid #F0F1F3', borderRadius: 10, marginBottom: 10,
        overflow: 'hidden', background: '#fff',
        cursor: isLast ? 'default' : 'pointer',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { if (!isLast) e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)' }}
      onMouseLeave={e => { if (!isLast) e.currentTarget.style.borderColor = '#F0F1F3' }}
    >
      {/* Header row */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <AvatarInitials name={msg.fromName} color={msg.fromColor} initials={msg.fromInitials} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{msg.fromName}</span>
          {msg.fromRole && (
            <span style={{
              marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 5px',
              borderRadius: 20, background: '#F3F4F6', color: '#374151',
            }}>{msg.fromRole}</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}
          title={formatFullDate(msg.timestamp)}>
          {formatTime(msg.timestamp)}
        </span>
        {!isLast && (
          <span style={{ fontSize: 10, color: '#C4C9D4', marginLeft: 4 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* Body */}
      {expanded && (
        <div style={{ borderTop: '1px solid #F0F1F3', padding: '12px 14px 16px' }}>
          <div className="mail-prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.body) }} />
        </div>
      )}

      {/* Collapsed preview */}
      {!expanded && (
        <div style={{ borderTop: '1px solid #F0F1F3', padding: '7px 14px', fontSize: 12, color: '#9CA3AF' }}>
          {msg.preview || 'Click to expand'}
        </div>
      )}
    </div>
  )
})

// ── Reply box ─────────────────────────────────────────────────
function ReplyBox({ message, onSent }) {
  const [body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [attachments, setAttachments] = useState([])
  const fileRef = useRef(null)

  const handleSend = useCallback(async () => {
    const trimmed = body.trim()
    if (!trimmed || isSending) return
    setIsSending(true)
    try {
      const { uploadAttachment } = await import('../services/supabase')
      const result = await sendMessage({
        subject: `Re: ${message.subject}`,
        body: trimmed,
        recipients: [{ userId: message.senderId }],
        threadId: message.threadId,
        idempotencyKey: genIdempotencyKey(),
      })
      if (attachments.length > 0 && result?.id) {
        await Promise.all(attachments.map(({ file }) => uploadAttachment(result.id, file)))
      }
      setBody('')
      setAttachments([])
      onSent?.()
    } catch (err) {
      console.error('Reply failed', err)
    } finally {
      setIsSending(false)
    }
  }, [body, isSending, message, attachments, onSent])

  const handleKeyDown = useCallback(e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend()
  }, [handleSend])

  return (
    <div style={{ borderTop: '1px solid #F0F1F3', padding: '10px 14px', background: '#fff' }}>
      <div
        style={{ border: '1.5px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}
        onFocusCapture={e => e.currentTarget.style.borderColor = '#D4AF37'}
        onBlurCapture={e => e.currentTarget.style.borderColor = '#E5E7EB'}
      >
        <div style={{
          padding: '6px 12px', background: '#F8F9FB', borderBottom: '1px solid #F0F1F3',
          fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          To: {message.senderName} &lt;{message.senderEmail}&gt;
        </div>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your reply…"
          style={{
            width: '100%', minHeight: 68, maxHeight: 160, border: 'none', outline: 'none',
            padding: '10px 12px', fontSize: 13.5, fontFamily: 'Inter, sans-serif',
            resize: 'vertical', color: '#111', background: '#fff', boxSizing: 'border-box',
          }}
        />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
          borderTop: '1px solid #F0F1F3', background: '#F8F9FB', flexWrap: 'wrap',
        }}>
          {attachments.length > 0 && (
            <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
              {attachments.map(({ file, id }) => (
                <span key={id} style={{
                  fontSize: 11, background: '#EFF6FF', border: '1px solid #BFDBFE',
                  borderRadius: 4, padding: '2px 8px', color: '#1D4ED8',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Paperclip size={9} /> {file.name}
                  <button onClick={() => setAttachments(p => p.filter(a => a.id !== id))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#6B7280', lineHeight: 1 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <button onClick={handleSend} disabled={isSending || !body.trim()}
            style={{
              background: isSending || !body.trim() ? '#E5E7EB' : '#D4AF37',
              color: isSending || !body.trim() ? '#9CA3AF' : '#111',
              border: 'none', borderRadius: 6, padding: '6px 16px',
              fontSize: 13, fontWeight: 600, cursor: isSending || !body.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <Send size={13} />
            {isSending ? 'Sending…' : 'Send Reply'}
          </button>
          <button onClick={() => fileRef.current?.click()}
            style={{
              fontSize: 12, padding: '5px 10px',
              border: '1px solid #E5E7EB', borderRadius: 6,
              background: 'transparent', color: '#374151', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
            <Paperclip size={12} /> Attach
          </button>
          <input ref={fileRef} type="file" multiple
            onChange={e => {
              const files = Array.from(e.target.files || [])
              setAttachments(p => [...p, ...files.map(f => ({ file: f, id: Math.random().toString(36).slice(2) }))])
              e.target.value = ''
            }}
            style={{ display: 'none' }} />
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9CA3AF' }}>
            <kbd style={{ fontSize: 10, background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 3, padding: '1px 4px' }}>Ctrl+↵</kbd>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main MessageThread ────────────────────────────────────────
export function MessageThread({ currentUser, onBack, showBackButton, onCollapse }) {
  const {
    selectedMessage, selectedThread, activeFolder,
    starMessage, moveMessage, markMessageRead, refreshThread,
  } = useMailbox()

  // ── Confirm dialog state ──────────────────────────────────
  const [confirm, setConfirm] = useState(null)
  // confirm = { variant, title, message, confirmLabel, onConfirm } | null

  const openConfirm = useCallback((opts) => setConfirm(opts), [])
  const closeConfirm = useCallback(() => setConfirm(null), [])

  // ── Action handlers — each one opens a confirm dialog first ─
  const handleDelete = useCallback(() => {
    if (!selectedMessage) return
    openConfirm({
      variant: 'delete',
      title: 'Move to Trash?',
      message: `"${selectedMessage.subject}" will be moved to Trash. You can restore it later.`,
      confirmLabel: 'Move to Trash',
      onConfirm: () => { closeConfirm(); moveMessage(selectedMessage.id, 'trash') },
    })
  }, [selectedMessage, moveMessage, openConfirm, closeConfirm])

  const handleArchive = useCallback(() => {
    if (!selectedMessage) return
    openConfirm({
      variant: 'archive',
      title: 'Archive this message?',
      message: `"${selectedMessage.subject}" will be archived and removed from your inbox.`,
      confirmLabel: 'Archive',
      onConfirm: () => { closeConfirm(); moveMessage(selectedMessage.id, 'archive') },
    })
  }, [selectedMessage, moveMessage, openConfirm, closeConfirm])

  const handleRestore = useCallback(() => {
    if (!selectedMessage) return
    openConfirm({
      variant: 'restore',
      title: 'Restore to Inbox?',
      message: `"${selectedMessage.subject}" will be moved back to your Inbox.`,
      confirmLabel: 'Restore',
      onConfirm: () => { closeConfirm(); moveMessage(selectedMessage.id, 'inbox') },
    })
  }, [selectedMessage, moveMessage, openConfirm, closeConfirm])

  const handlePermDelete = useCallback(() => {
    if (!selectedMessage) return
    openConfirm({
      variant: 'permDelete',
      title: 'Delete permanently?',
      message: `"${selectedMessage.subject}" will be permanently deleted and cannot be recovered.`,
      confirmLabel: 'Delete Forever',
      onConfirm: () => { closeConfirm(); moveMessage(selectedMessage.id, 'deleted') },
    })
  }, [selectedMessage, moveMessage, openConfirm, closeConfirm])

  const handleStar = useCallback(() => {
    if (!selectedMessage) return
    starMessage(selectedMessage.id)
  }, [selectedMessage, starMessage])

  const handleToggleRead = useCallback(() => {
    if (!selectedMessage) return
    markMessageRead(selectedMessage.id, !selectedMessage.is_read)
  }, [selectedMessage, markMessageRead])

  if (!selectedMessage) return <EmptyThreadPanel />

  const msg = selectedMessage

  const threadMessages = (selectedThread?.length > 0 ? selectedThread : null)
    ?.map(normalizeThreadMsg)
    ?? [{
      id: msg.id, fromName: msg.senderName, fromInitials: msg.senderInitials,
      fromRole: msg.senderRole, fromColor: msg.senderAvatar,
      timestamp: msg.timestamp, body: msg.body, preview: msg.preview, attachments: msg.attachments || [],
    }]

  // Per-folder action buttons — Gmail model
  const actionButtons = (() => {
    const starBtn = {
      icon: <Star size={14} strokeWidth={1.75}
        fill={msg.is_starred ? '#D4AF37' : 'none'}
        color={msg.is_starred ? '#D4AF37' : '#6B7280'} />,
      onClick: handleStar,
      title: msg.is_starred ? 'Unstar' : 'Star',
    }
    // Eye toggle: shows EyeOff when read (click to mark unread), Eye when unread (click to mark read)
    const readBtn = {
      icon: msg.is_read
        ? <EyeOff size={14} strokeWidth={1.75} />
        : <Eye    size={14} strokeWidth={1.75} />,
      onClick: handleToggleRead,
      title: msg.is_read ? 'Mark as unread' : 'Mark as read',
    }
    const archiveBtn = { icon: <Archive size={14} strokeWidth={1.75} />, onClick: handleArchive, title: 'Archive' }
    const deleteBtn  = { icon: <Trash2  size={14} strokeWidth={1.75} />, onClick: handleDelete,  title: 'Move to Trash', danger: true }
    const restoreBtn = { icon: <Archive size={14} strokeWidth={1.75} />, onClick: handleRestore, title: 'Restore to Inbox' }
    const permDelBtn = { icon: <Trash2  size={14} strokeWidth={1.75} />, onClick: handlePermDelete, title: 'Delete permanently', danger: true }
    const toInboxBtn = { icon: <Archive size={14} strokeWidth={1.75} />, onClick: handleRestore, title: 'Move to Inbox' }

    switch (activeFolder) {
      case 'trash':   return [restoreBtn, permDelBtn]
      case 'sent':    return [starBtn, deleteBtn]
      case 'archive': return [starBtn, toInboxBtn, deleteBtn]
      default:        return [starBtn, readBtn, archiveBtn, deleteBtn]  // inbox / starred / priority
    }
  })()

  const showReplyBox = activeFolder !== 'trash' && activeFolder !== 'sent'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif', overflow: 'hidden', background: '#fff' }}>

      <ConfirmDialog
        open={!!confirm}
        variant={confirm?.variant}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={confirm?.onConfirm}
        onCancel={closeConfirm}
      />

      <div style={{
        padding: '13px 14px 12px', background: '#fff', borderBottom: '1px solid #F0F1F3',
        display: 'flex', alignItems: 'flex-start', gap: 10, flexShrink: 0,
      }}>
        {showBackButton && (
          <button onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 4px', marginTop: 1, flexShrink: 0 }}>
            <ArrowLeft size={17} color="#6B7280" />
          </button>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', lineHeight: 1.35 }}>
            {msg.subject}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {msg.isPriority && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#FEF2F2', color: '#991B1B' }}>Urgent</span>
            )}
            {(selectedThread?.length ?? 0) > 1 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280' }}>
                {selectedThread.length} messages
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 3, flexShrink: 0, alignItems: 'center' }}>
          {actionButtons.map((btn, i) => (
            <button key={i} onClick={btn.onClick} title={btn.title}
              style={{
                width: 30, height: 30, border: '1px solid #E5E7EB', borderRadius: 6,
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B7280', transition: 'all 0.12s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background   = btn.danger ? '#FEF2F2' : '#F3F4F6'
                e.currentTarget.style.color        = btn.danger ? '#DC2626' : '#111'
                e.currentTarget.style.borderColor  = btn.danger ? '#FECACA' : '#D1D5DB'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background   = 'transparent'
                e.currentTarget.style.color        = '#6B7280'
                e.currentTarget.style.borderColor  = '#E5E7EB'
              }}>
              {btn.icon}
            </button>
          ))}

          {onCollapse && (
            <button onClick={onCollapse} title="Minimize panel"
              className="thread-collapse-btn"
              style={{
                width: 30, height: 30, border: '1px solid #E5E7EB', borderRadius: 6,
                background: 'transparent', cursor: 'pointer', marginLeft: 2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#9CA3AF', transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#374151' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}>
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 6px', minHeight: 0 }}>
        {selectedThread?.length === 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <Loader size={16} color="#D4AF37" style={{ animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {threadMessages.map((tm, i) => (
          <ThreadMessage key={tm.id} msg={tm} isLast={i === threadMessages.length - 1} />
        ))}
      </div>

      {showReplyBox && (
        <div style={{ flexShrink: 0 }}>
          <ReplyBox message={msg} onSent={() => refreshThread(msg.threadId)} />
        </div>
      )}

      <style>{`
        .mail-prose p      { margin: 0 0 .65em; color: #374151; font-size: 13.5px; line-height: 1.65 }
        .mail-prose ul     { margin: .4em 0 .65em 1.2em; list-style: disc }
        .mail-prose li     { margin-bottom: .2em; color: #374151; font-size: 13.5px; line-height: 1.6 }
        .mail-prose strong { font-weight: 600; color: #111 }
        .mail-prose code   { font-family: 'SF Mono',monospace; font-size: 12px; background: #F3F4F6; padding: 1px 5px; border-radius: 4px }
        @media (max-width: 640px) { .thread-collapse-btn { display: none !important; } }
      `}</style>
    </div>
  )
}