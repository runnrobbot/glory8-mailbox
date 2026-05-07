import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Paperclip, AlertTriangle, Trash2, Search, ChevronDown } from 'lucide-react'
import {
  sendMessage, uploadAttachment, searchProfiles,
  fetchProfilesByRole, fetchAppRoles, deleteMessageWithAttachments,
} from '../services/supabase'
import { genIdempotencyKey } from '../utils/index'
import { AvatarInitials } from './AvatarInitials'

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function RecipientSearch({ selectedUsers, onAdd, onRemove }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen]   = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef              = useRef(null)
  const dropdownRef           = useRef(null)

  useEffect(() => {
    if (!query.trim()) { setResults([]); setIsOpen(false); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await searchProfiles(query, null)
        setResults(data.filter(u => !selectedUsers.find(s => s.id === u.id)))
        setIsOpen(true)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, selectedUsers])

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (user) => {
    onAdd(user)
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: selectedUsers.length ? 6 : 0 }}>
        {selectedUsers.map(u => (
          <span key={u.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#F5E9B8', borderRadius: 20, padding: '2px 8px 2px 4px', fontSize: 12, color: '#7A5A00', fontWeight: 500 }}>
            <AvatarInitials name={u.name} size={18} />
            {u.name}
            <button onClick={() => onRemove(u.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#B8962E', marginLeft: 1 }}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Search size={13} color="#9CA3AF" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
          placeholder={selectedUsers.length ? 'Add more…' : 'Search by name or email…'}
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, fontFamily: 'Inter, sans-serif', color: '#111', background: 'transparent' }}
        />
        {loading && <span style={{ fontSize: 11, color: '#9CA3AF' }}>…</span>}
      </div>

      {isOpen && results.length > 0 && (
        <div ref={dropdownRef} style={{ position: 'absolute', top: '100%', left: -18, right: -18, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 2000, maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
          {results.map(u => (
            <button key={u.id} onMouseDown={() => handleSelect(u)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8F9FB'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <AvatarInitials name={u.name} size={28} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{u.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{u.email} {u.role ? `· ${u.role}` : ''}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {isOpen && query && results.length === 0 && !loading && (
        <div style={{ position: 'absolute', top: '100%', left: -18, right: -18, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 2000, padding: '12px 14px', marginTop: 4, fontSize: 12.5, color: '#9CA3AF' }}>
          No users found for "{query}"
        </div>
      )}
    </div>
  )
}

function RoleRecipientPicker({ selectedRole, onSelect, appRoles }) {
  const [isOpen, setIsOpen]         = useState(false)
  const [roleUsers, setRoleUsers]   = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const ref = useRef(null)

  const dynamicRoleNames = appRoles.map(r => r.name)
  const options = [
    { value: 'broadcast', label: '📢 Broadcast — All Users', isBroadcast: true },
    ...dynamicRoleNames.map(r => ({ value: r, label: r })),
  ]
  const selectedOption = options.find(o => o.value === selectedRole) || options[0]

  useEffect(() => {
    const handler = e => { if (!ref.current?.contains(e.target)) setIsOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!selectedRole || selectedRole === 'broadcast') { setRoleUsers([]); return }
    setLoadingUsers(true)
    fetchProfilesByRole(selectedRole)
      .then(data => { setRoleUsers(data); setLoadingUsers(false) })
      .catch(() => setLoadingUsers(false))
  }, [selectedRole])

  return (
    <div style={{ flex: 1 }}>
      <div ref={ref} style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13.5, fontFamily: 'Inter, sans-serif', color: '#111', padding: 0 }}>
          <span style={{ fontWeight: selectedRole ? 500 : 400, color: selectedRole ? '#111' : '#9CA3AF' }}>
            {selectedOption?.label || 'Select role…'}
          </span>
          <ChevronDown size={13} color="#9CA3AF" />
        </button>

        {isOpen && (
          <div style={{ position: 'absolute', top: '100%', left: -18, right: -18, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 2000, maxHeight: 240, overflowY: 'auto', marginTop: 4 }}>
            {options.map(opt => (
              <button key={opt.value} onMouseDown={() => { onSelect(opt.value); setIsOpen(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px', border: 'none', background: selectedRole === opt.value ? '#F5E9B8' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s', fontSize: 13, fontWeight: selectedRole === opt.value ? 600 : 400, color: '#111' }}
                onMouseEnter={e => { if (selectedRole !== opt.value) e.currentTarget.style.background = '#F8F9FB' }}
                onMouseLeave={e => { if (selectedRole !== opt.value) e.currentTarget.style.background = 'transparent' }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedRole && selectedRole !== 'broadcast' && (
        <div style={{ marginTop: 6 }}>
          {loadingUsers ? (
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>Loading recipients…</span>
          ) : roleUsers.length === 0 ? (
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>No active users in this role</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {roleUsers.slice(0, 5).map(u => (
                <span key={u.id} style={{ fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <AvatarInitials name={u.name} size={14} />
                  {u.name}
                  {roleUsers.indexOf(u) < roleUsers.slice(0, 5).length - 1 && roleUsers.length <= 5 ? ',' : ''}
                </span>
              ))}
              {roleUsers.length > 5 && <span style={{ fontSize: 11, color: '#9CA3AF' }}>+{roleUsers.length - 5} more</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ComposeModal({ isOpen, onClose, currentUser, prefill = {} }) {
  const [recipientMode, setRecipientMode] = useState('individual')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [selectedRole, setSelectedRole]   = useState('')
  const [subject, setSubject]             = useState(prefill.subject || '')
  const [body, setBody]                   = useState('')
  const [isPriority, setIsPriority]       = useState(false)
  const [isSending, setIsSending]         = useState(false)
  const [error, setError]                 = useState(null)
  const [attachments, setAttachments]     = useState([])
  const [appRoles, setAppRoles]           = useState([])
  const subjectRef        = useRef(null)
  const fileRef           = useRef(null)
  const isSendingRef      = useRef(false)
  const idempotencyKeyRef = useRef(genIdempotencyKey())

  const canViewOrgInfo = currentUser?.permissions?.canViewOrgInfo || false

  useEffect(() => {
    if (!isOpen) return
    fetchAppRoles().then(setAppRoles).catch(() => {})
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => subjectRef.current?.focus(), 50)
      idempotencyKeyRef.current = genIdempotencyKey()
      if (prefill.to) setSelectedUsers([{ id: prefill.to, name: prefill.to, email: prefill.to }])
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const reset = useCallback(() => {
    setSelectedUsers([]); setSelectedRole(''); setSubject(''); setBody('')
    setIsPriority(false); setError(null); setAttachments([]); setRecipientMode('individual')
  }, [])

  const handleClose = useCallback(() => { reset(); onClose() }, [reset, onClose])

  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files || [])
    const MAX = 10 * 1024 * 1024
    const valid = files.filter(f => {
      if (f.size > MAX) { setError(`File "${f.name}" exceeds 10MB limit`); return false }
      return true
    })
    setAttachments(prev => [...prev, ...valid.map(f => ({ file: f, id: Math.random().toString(36).slice(2) }))])
    e.target.value = ''
  }, [])

  const handleSend = useCallback(async () => {
    if (isSendingRef.current) return
    isSendingRef.current = true
    setError(null)

    if (!subject.trim()) { setError('Subject is required'); isSendingRef.current = false; return }
    if (!body.trim())    { setError('Message body is required'); isSendingRef.current = false; return }
    if (recipientMode === 'individual' && selectedUsers.length === 0) {
      setError('Please select at least one recipient'); isSendingRef.current = false; return
    }
    if (recipientMode === 'role' && !selectedRole) {
      setError('Please select a role to send to'); isSendingRef.current = false; return
    }
    if (recipientMode === 'role' && !canViewOrgInfo) {
      setError('Only HR and above can send to roles or broadcast'); isSendingRef.current = false; return
    }

    setIsSending(true)
    let sentMessageId = null

    try {
      const recipients = recipientMode === 'role'
        ? [{ role: selectedRole === 'broadcast' ? undefined : selectedRole }]
        : selectedUsers.map(u => ({ userId: u.id }))

      const result = await sendMessage({
        subject: subject.trim(),
        body:    body.trim(),
        recipients,
        isPriority,
        idempotencyKey: idempotencyKeyRef.current,
      })
      sentMessageId = result.id

      if (attachments.length > 0 && sentMessageId) {
        const uploadResults = await Promise.allSettled(
          attachments.map(({ file }) => uploadAttachment(sentMessageId, file))
        )
        const failures = uploadResults.filter(r => r.status === 'rejected')
        if (failures.length > 0) {
          await deleteMessageWithAttachments(sentMessageId).catch(() => {})
          const failedNames = attachments
            .filter((_, i) => uploadResults[i].status === 'rejected')
            .map(a => a.file.name).join(', ')
          throw new Error(`Upload failed for: ${failedNames}. Message cancelled, please try again.`)
        }
      }

      reset()
      onClose(true)
    } catch (err) {
      setError(err.message || 'Failed to send message. Please try again.')
      idempotencyKeyRef.current = genIdempotencyKey()
    } finally {
      isSendingRef.current = false
      setIsSending(false)
    }
  }, [subject, body, recipientMode, selectedUsers, selectedRole, isPriority, canViewOrgInfo, attachments, reset, onClose])

  if (!isOpen) return null

  const modeTabStyle = (active) => ({
    fontSize: 11, fontWeight: active ? 600 : 500, padding: '3px 10px', borderRadius: 20,
    border: 'none', cursor: 'pointer', background: active ? '#D4AF37' : 'transparent',
    color: active ? '#111' : '#9CA3AF', transition: 'all 0.12s',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '0 24px 24px', fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: 580, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'modal-in 0.2s ease', pointerEvents: 'all' }}>
        <style>{`@keyframes modal-in{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:none}}`}</style>

        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F1F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>New Message</div>
          <button onClick={handleClose} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#F8F9FB'; e.currentTarget.style.color = '#111' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* To */}
          <div style={{ borderBottom: '1px solid #F0F1F3', padding: '10px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', minWidth: 50 }}>To</div>
              <div style={{ display: 'flex', gap: 2, background: '#F8F9FB', borderRadius: 20, padding: 2 }}>
                <button style={modeTabStyle(recipientMode === 'individual')} onClick={() => { setRecipientMode('individual'); setSelectedRole('') }}>
                  Individual
                </button>
                {canViewOrgInfo && (
                  <button style={modeTabStyle(recipientMode === 'role')} onClick={() => { setRecipientMode('role'); setSelectedUsers([]) }}>
                    Role / Broadcast
                  </button>
                )}
              </div>
            </div>
            <div style={{ paddingLeft: 60 }}>
              {recipientMode === 'individual' ? (
                <RecipientSearch
                  selectedUsers={selectedUsers}
                  onAdd={u => setSelectedUsers(prev => [...prev, u])}
                  onRemove={id => setSelectedUsers(prev => prev.filter(u => u.id !== id))}
                />
              ) : (
                <RoleRecipientPicker selectedRole={selectedRole} onSelect={setSelectedRole} appRoles={appRoles} />
              )}
            </div>
          </div>

          {/* Subject */}
          <div style={{ borderBottom: '1px solid #F0F1F3', padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', minWidth: 50 }}>Subject</div>
            <input ref={subjectRef} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, fontFamily: 'Inter, sans-serif', color: '#111', background: 'transparent', fontWeight: subject ? 500 : 400 }} />
          </div>

          {/* Body */}
          <textarea value={body} onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSend() } }}
            placeholder="Write your message here…"
            style={{ width: '100%', border: 'none', outline: 'none', minHeight: 160, padding: '14px 18px', fontSize: 13.5, fontFamily: 'Inter, sans-serif', color: '#111', resize: 'vertical', boxSizing: 'border-box' }} />

          {/* Attachments */}
          {attachments.length > 0 && (
            <div style={{ padding: '8px 18px 12px', borderTop: '1px solid #F0F1F3' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Attachments</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {attachments.map(({ file, id }) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#F8F9FB', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, padding: '5px 10px', fontSize: 12 }}>
                    <Paperclip size={12} color="#6B7280" />
                    <span style={{ color: '#374151', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    <span style={{ color: '#9CA3AF', fontSize: 11 }}>{formatBytes(file.size)}</span>
                    <button onClick={() => setAttachments(prev => prev.filter(a => a.id !== id))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#9CA3AF' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                      onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ margin: '0 18px 10px', padding: '8px 12px', background: '#FEF2F2', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#DC2626' }}>
              <AlertTriangle size={13} />{error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1px solid #F0F1F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#F8F9FB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={isPriority} onChange={e => setIsPriority(e.target.checked)} style={{ accentColor: '#D4AF37' }} />
              <AlertTriangle size={14} color="#D97706" />
              Urgent
            </label>
            <button onClick={() => fileRef.current?.click()} title="Attach files"
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, padding: '5px 10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: 'transparent', color: '#374151', cursor: 'pointer' }}>
              <Paperclip size={13} /> Attach
            </button>
            <input ref={fileRef} type="file" multiple onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { reset(); onClose() }}
              style={{ fontSize: 12, fontWeight: 500, padding: '6px 12px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: 'transparent', color: '#374151', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={handleSend} disabled={isSending}
              style={{ background: isSending ? '#E5E7EB' : '#D4AF37', color: isSending ? '#9CA3AF' : '#111', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: isSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              {isSending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
