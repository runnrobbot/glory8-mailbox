import { memo, useCallback, useState } from 'react'
import { Search, Paperclip, RefreshCw, Trash2, Archive, RotateCcw, CheckSquare } from 'lucide-react'
import { useMailboxList, useKeyboardNav } from '../hooks/useMailboxList'
import { useMailbox } from '../context/MailboxContext'
import { AvatarInitials } from './AvatarInitials'
import { formatTime } from '../utils/time'
import { ConfirmDialog } from './ConfirmDialog'

const FOLDER_LABELS = {
  inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts',
  starred: 'Starred', trash: 'Trash', archive: 'Archive',
}

const FILTERS = [
  { id: 'all',        label: 'All' },
  { id: 'unread',     label: 'Unread' },
  { id: 'priority',   label: 'Priority' },
  { id: 'attachment', label: 'Files' },
]

function SkeletonItem() {
  const shimmer = {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: 4,
  }
  return (
    <div style={{ padding: '12px 12px 11px', marginBottom: 2 }}>
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ ...shimmer, width: 30, height: 30, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div style={{ ...shimmer, height: 12, marginBottom: 4 }} />
          <div style={{ ...shimmer, height: 10, width: '60%' }} />
        </div>
      </div>
      <div style={{ ...shimmer, height: 11, marginBottom: 4 }} />
      <div style={{ ...shimmer, height: 10, width: '80%' }} />
    </div>
  )
}

function Checkbox({ checked, indeterminate, onChange, size = 15 }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(!checked) }}
      style={{
        width: size, height: size, borderRadius: 4, flexShrink: 0,
        border: `1.5px solid ${checked || indeterminate ? '#D4AF37' : '#D1D5DB'}`,
        background: checked || indeterminate ? '#D4AF37' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      {indeterminate && !checked ? (
        <div style={{ width: size * 0.55, height: 2, background: '#fff', borderRadius: 1 }} />
      ) : checked ? (
        <svg width={size * 0.65} height={size * 0.65} viewBox="0 0 12 12" fill="none">
          <polyline points="2,6 5,9 10,3" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : null}
    </div>
  )
}

const MessageItem = memo(function MessageItem({ msg, isSelected, onSelect, isChecked, onCheck, checkMode }) {
  const isUnread = !msg.is_read

  const handleClick = useCallback((e) => {
    if (checkMode) { onCheck(msg.id, !isChecked); return }
    onSelect(msg.id)
  }, [msg.id, onSelect, onCheck, isChecked, checkMode])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={e => e.key === 'Enter' && handleClick(e)}
      style={{
        padding: '11px 12px 10px',
        borderRadius: 10, marginBottom: 2,
        cursor: 'pointer', position: 'relative',
        border: '1.5px solid transparent',
        background: isChecked ? 'rgba(212,175,55,0.12)' : isSelected ? '#F5E9B8' : 'transparent',
        borderColor: isChecked ? 'rgba(212,175,55,0.4)' : isSelected ? 'rgba(212,175,55,0.3)' : 'transparent',
        transition: 'background 0.12s',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}
      onMouseEnter={e => {
        if (!isSelected && !isChecked) e.currentTarget.style.background = 'rgba(212,175,55,0.06)'
        e.currentTarget.querySelector('.msg-cb').style.opacity = '1'
      }}
      onMouseLeave={e => {
        if (!isSelected && !isChecked) e.currentTarget.style.background = 'transparent'
        if (!checkMode && !isChecked) e.currentTarget.querySelector('.msg-cb').style.opacity = '0'
      }}
    >
      <div className="msg-cb" style={{ opacity: checkMode || isChecked ? 1 : 0, transition: 'opacity 0.15s', paddingTop: 3, flexShrink: 0 }}>
        <Checkbox checked={isChecked} onChange={v => onCheck(msg.id, v)} size={15} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {isUnread && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4AF37', position: 'absolute', left: checkMode ? 30 : 4, top: '50%', transform: 'translateY(-50%)', transition: 'left 0.15s' }} />
        )}
        <div style={{ paddingLeft: isUnread ? (checkMode ? 0 : 8) : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <AvatarInitials name={msg.senderName} color={msg.senderColor} initials={msg.senderInitials} size={28} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: isUnread ? 700 : 500, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {msg.senderName}
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>{formatTime(msg.timestamp)}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: isUnread ? 600 : 500, color: isUnread ? '#111' : '#374151', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {msg.subject}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {msg.preview}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {msg.isPriority && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#FEF2F2', color: '#991B1B' }}>Urgent</span>}
            {msg.isStarred && <svg width="12" height="12" viewBox="0 0 24 24" fill="#D4AF37"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>}
            {msg.attachments?.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: '#F0F9FF', color: '#0369A1', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Paperclip size={9} />{msg.attachments.length}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

function BulkBtn({ icon, label, onClick, color, bgColor, borderColor }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: `1px solid ${borderColor}`, background: bgColor, color, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s' }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = color }}
      onMouseLeave={e => { e.currentTarget.style.background = bgColor; e.currentTarget.style.color = color; e.currentTarget.style.borderColor = borderColor }}
    >
      {icon} {label}
    </button>
  )
}

export function MessageList({ onOpenShortcuts }) {
  const { activeFolder, moveMessage } = useMailbox()
  const { filtered, isLoading, hasMore, unreadCount, searchQuery, activeFilter, selectedId, setActiveFilter, handleSearch, selectMessage, loadMoreRef } = useMailboxList()
  useKeyboardNav(filtered)

  const [checkedIds, setCheckedIds] = useState(new Set())
  const [confirm, setConfirm] = useState(null)
  const checkMode = checkedIds.size > 0

  const handleCheck = useCallback((id, checked) => {
    setCheckedIds(prev => { const n = new Set(prev); checked ? n.add(id) : n.delete(id); return n })
  }, [])
  const handleSelectAll = useCallback(() => setCheckedIds(new Set(filtered.map(m => m.id))), [filtered])
  const handleDeselectAll = useCallback(() => setCheckedIds(new Set()), [])

  const handleBulkAction = useCallback((targetFolder) => {
    const count = checkedIds.size
    if (!count) return
    const configs = {
      deleted: { variant: 'permDelete', title: `Delete ${count} message${count>1?'s':''} permanently?`, message: `These ${count} message${count>1?'s':''} will be permanently deleted and cannot be recovered.`, confirmLabel: 'Delete Forever' },
      trash:   { variant: 'delete',     title: `Move ${count} message${count>1?'s':''} to Trash?`,       message: `These ${count} message${count>1?'s':''} will be moved to Trash. You can restore them later.`,  confirmLabel: 'Move to Trash' },
      inbox:   { variant: 'restore',    title: `Restore ${count} message${count>1?'s':''} to Inbox?`,     message: `These ${count} message${count>1?'s':''} will be moved back to your Inbox.`,                     confirmLabel: 'Restore' },
      archive: { variant: 'archive',    title: `Archive ${count} message${count>1?'s':''}?`,               message: `These ${count} message${count>1?'s':''} will be archived and removed from your inbox.`,         confirmLabel: 'Archive' },
    }
    const cfg = configs[targetFolder] || configs.trash
    setConfirm({
      ...cfg,
      onConfirm: async () => {
        setConfirm(null)
        const ids = Array.from(checkedIds)
        setCheckedIds(new Set())
        await Promise.allSettled(ids.map(id => moveMessage(id, targetFolder)))
      },
    })
  }, [checkedIds, moveMessage])

  const isTrash = activeFolder === 'trash'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8F9FB', borderRight: '1px solid #F0F1F3', fontFamily: 'Inter, sans-serif' }}>

      <ConfirmDialog
        open={!!confirm}
        variant={confirm?.variant}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      {/* Header */}
      <div style={{ padding: '18px 16px 14px', background: '#fff', borderBottom: '1px solid #F0F1F3' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>
            {FOLDER_LABELS[activeFolder] || activeFolder}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {unreadCount > 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, background: '#F5E9B8', color: '#7A5A00', padding: '2px 8px', borderRadius: 20 }}>
                {unreadCount} unread
              </div>
            )}
            <button
              onClick={checkMode ? handleDeselectAll : handleSelectAll}
              title={checkMode ? 'Cancel selection' : 'Select all'}
              style={{ width: 26, height: 26, border: `1px solid ${checkMode ? '#D4AF37' : '#E5E7EB'}`, borderRadius: 6, background: checkMode ? '#F5E9B8' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: checkMode ? '#7A5A00' : '#9CA3AF', transition: 'all 0.12s' }}
            >
              <CheckSquare size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 10 }}>
          <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input type="text" value={searchQuery} onChange={handleSearch} placeholder="Search messages…"
            style={{ width: '100%', background: '#F8F9FB', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, padding: '8px 12px 8px 34px', fontSize: 13, color: '#111', outline: 'none', fontFamily: 'Inter, sans-serif', transition: 'border 0.15s', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = '#D4AF37'}
            onBlur={e => e.target.style.borderColor = 'rgba(0,0,0,0.08)'}
          />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)}
              style={{ fontSize: 11, fontWeight: f.id === activeFilter ? 600 : 500, padding: '4px 10px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid rgba(0,0,0,0.08)', transition: 'all 0.12s', background: f.id === activeFilter ? '#F5E9B8' : '#fff', color: f.id === activeFilter ? '#7A5A00' : '#374151', borderColor: f.id === activeFilter ? '#D4AF37' : 'rgba(0,0,0,0.08)' }}>
              {f.label}
            </button>
          ))}
          <button onClick={onOpenShortcuts} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }} title="Keyboard shortcuts">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/></svg>
          </button>
        </div>
      </div>

      {/* Bulk toolbar */}
      {checkMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A', animation: 'slideDown 0.18s ease' }}>
          <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <Checkbox
            checked={checkedIds.size === filtered.length && filtered.length > 0}
            indeterminate={checkedIds.size > 0 && checkedIds.size < filtered.length}
            onChange={v => v ? handleSelectAll() : handleDeselectAll()}
            size={15}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginRight: 4 }}>{checkedIds.size} selected</span>
          {isTrash ? (
            <>
              <BulkBtn icon={<RotateCcw size={13}/>} label="Restore" onClick={() => handleBulkAction('inbox')} color="#16A34A" bgColor="#F0FDF4" borderColor="#BBF7D0" />
              <BulkBtn icon={<Trash2 size={13}/>} label="Delete forever" onClick={() => handleBulkAction('deleted')} color="#DC2626" bgColor="#FEF2F2" borderColor="#FECACA" />
            </>
          ) : (
            <>
              <BulkBtn icon={<Archive size={13}/>} label="Archive" onClick={() => handleBulkAction('archive')} color="#2563EB" bgColor="#EFF6FF" borderColor="#BFDBFE" />
              <BulkBtn icon={<Trash2 size={13}/>} label="Trash" onClick={() => handleBulkAction('trash')} color="#DC2626" bgColor="#FEF2F2" borderColor="#FECACA" />
            </>
          )}
          <button onClick={handleDeselectAll} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6B7280', padding: '3px 8px', borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >Cancel</button>
        </div>
      )}

      {/* Message list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
        {isLoading && !filtered.length ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonItem key={i} />)
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', color: '#6B7280' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" style={{ marginBottom: 12, color: '#9CA3AF' }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{searchQuery ? 'No results found' : 'Empty folder'}</div>
            <div style={{ fontSize: 12 }}>{searchQuery ? `No messages match "${searchQuery}"` : 'Nothing to show here'}</div>
          </div>
        ) : (
          <>
            {filtered.map(msg => (
              <MessageItem key={msg.id} msg={msg} isSelected={msg.id === selectedId} onSelect={selectMessage} isChecked={checkedIds.has(msg.id)} onCheck={handleCheck} checkMode={checkMode} />
            ))}
            {hasMore && (
              <div ref={loadMoreRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isLoading && <RefreshCw size={14} color="#9CA3AF" style={{ animation: 'spin 1s linear infinite' }} />}
                <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
