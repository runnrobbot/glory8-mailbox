import { useState, useCallback, useEffect } from 'react'
import { Menu, ChevronLeft } from 'lucide-react'
import { MailboxProvider } from '../context/MailboxContext'
import { useRealtime, useVisibilitySync } from '../hooks/useRealtime'
import { Sidebar } from '../components/Sidebar'
import { MessageList } from '../components/MessageList'
import { MessageThread, EmptyThreadPanel } from '../components/MessageThread'
import { ComposeModal } from '../components/ComposeModal'
import { ShortcutsModal } from '../components/ShortcutsModal'
import { NotificationToast } from '../components/NotificationToast'
import { ProfileSettingsModal } from '../components/ProfileSettingsModal'
import { UserManagementPage } from './UserManagementPage'
import { AuditLogsPage } from './AuditLogsPage'
import { useMailbox } from '../context/MailboxContext'

function MailboxInner({ currentUser, onSignOut }) {
  const {
    ingestRealtimeMessage, loadMessages, activeFolder,
    selectMessage, selectedMessage,
  } = useMailbox()

  const [composeOpen,       setComposeOpen]       = useState(false)
  const [shortcutsOpen,     setShortcutsOpen]     = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [activePage,        setActivePage]        = useState('mailbox')
  const [profileOpen,       setProfileOpen]       = useState(false)
  const [pendingToast,      setPendingToast]      = useState(null)
  const [mobileShowThread,  setMobileShowThread]  = useState(false)


  const [threadCollapsed, setThreadCollapsed] = useState(false)

  useEffect(() => {
    if (selectedMessage) setMobileShowThread(true)
  }, [selectedMessage?.id])

  useEffect(() => {
    if (selectedMessage) setThreadCollapsed(false)
  }, [selectedMessage?.id])

  useRealtime({
    userId:   currentUser?.id,
    userRole: currentUser?.role || null,
    onNewMessage: useCallback((rawMsg, recipientRow) => {
      if (!rawMsg) { loadMessages(activeFolder); return }
      const normalized = normalizeRealtimeMessage(rawMsg, recipientRow)
      ingestRealtimeMessage(normalized, 'inbox')
      setPendingToast({
        id:         normalized.id,
        senderName: normalized.senderName,
        subject:    normalized.subject,
        isPriority: normalized.isPriority,
      })
    }, [ingestRealtimeMessage, loadMessages, activeFolder]),
    onReadUpdate:   useCallback(() => {}, []),
    onResync:       useCallback(() => { loadMessages(activeFolder) }, [loadMessages, activeFolder]),
    onStatusChange: () => {},
  })

  useVisibilitySync(useCallback(() => { loadMessages(activeFolder) }, [loadMessages, activeFolder]))

  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || composeOpen || shortcutsOpen) return
      if ((e.key === 'c' || e.key === 'C') && activeFolder !== 'trash') setComposeOpen(true)
      if (e.key === '?') setShortcutsOpen(true)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [composeOpen, shortcutsOpen, activeFolder])

  const sidebar = (
    <Sidebar
      currentUser={currentUser}
      onCompose={() => { setActivePage('mailbox'); setComposeOpen(true); setMobileSidebarOpen(false) }}
      isMobileOpen={mobileSidebarOpen}
      onMobileClose={() => setMobileSidebarOpen(false)}
      onUserManagement={() => { setActivePage('users'); setMobileSidebarOpen(false) }}
      onAuditLogs={() => { setActivePage('audit'); setMobileSidebarOpen(false) }}
      onOpenProfile={() => { setProfileOpen(true); setMobileSidebarOpen(false) }}
    />
  )

  if (activePage === 'users' || activePage === 'audit') {
    const PageComponent = activePage === 'users' ? UserManagementPage : AuditLogsPage
    return (
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
        <div className="sidebar-desktop-wrap">{sidebar}</div>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <PageComponent currentUser={currentUser} onBack={() => setActivePage('mailbox')} />
        </div>
        <style>{`.sidebar-desktop-wrap{width:240px;min-width:240px;height:100%;background:#fff;border-right:1px solid #F0F1F3;flex-shrink:0}@media(max-width:768px){.sidebar-desktop-wrap{display:none}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, sans-serif', background: '#F8F9FB' }}>
      {sidebar}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0, flexDirection: 'column' }}>

        <div className="mb-topbar">
          {mobileShowThread && selectedMessage ? (
            <button onClick={() => setMobileShowThread(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.75">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          ) : (
            <button onClick={() => setMobileSidebarOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0 }}>
              <Menu size={20} color="#374151" strokeWidth={1.75} />
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: 'linear-gradient(135deg,#D4AF37,#B8962E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#111', flexShrink: 0 }}>G8</div>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mobileShowThread && selectedMessage ? selectedMessage.subject || 'Message' : 'Glory8 Mailbox'}
            </span>
          </div>
        </div>

        {/* ── Panel area ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }}>

          <div className={[
            'panel-list',
            mobileShowThread    ? 'panel-list--hidden'   : '',
            threadCollapsed     ? 'panel-list--expanded' : '',
          ].join(' ').trim()}>
            <MessageList onOpenShortcuts={() => setShortcutsOpen(true)} />
          </div>

          {!threadCollapsed && (
            <div className={`panel-thread${mobileShowThread ? ' panel-thread--active' : ''}`}>
              {selectedMessage
                ? <MessageThread
                    currentUser={currentUser}
                    onBack={() => setMobileShowThread(false)}
                    showBackButton={mobileShowThread}
                    onCollapse={() => setThreadCollapsed(true)}
                  />
                : <EmptyThreadPanel />
              }
            </div>
          )}

          {threadCollapsed && (
            <button
              className="thread-expand-strip"
              onClick={() => setThreadCollapsed(false)}
              title="Show thread panel"
            >
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <ComposeModal
      isOpen={composeOpen}
        onClose={(sent) => {
          setComposeOpen(false)
          if (sent) loadMessages(activeFolder)
        }}
        currentUser={currentUser}
      />
      <ProfileSettingsModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} currentUser={currentUser} onSignOut={onSignOut} />
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {pendingToast && (
        <NotificationToast
          notification={pendingToast}
          onView={() => { selectMessage(pendingToast.id); setPendingToast(null) }}
          onDismiss={() => setPendingToast(null)}
        />
      )}

      {/* Mobile FAB — compose button */}
      <button
        className={`mobile-fab${activeFolder === 'trash' ? ' mobile-fab--hidden' : ''}`}
        onClick={() => setComposeOpen(true)}
        aria-label="Compose"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.2">
          <path d="M12 5H5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-7"/>
          <path d="M17.5 3.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z"/>
        </svg>
      </button>

      <style>{`
        /* ── Mobile top bar ── */
        .mb-topbar {
          display: none; align-items: center; padding: 0 12px;
          background: #fff; border-bottom: 1px solid #F0F1F3;
          height: 52px; flex-shrink: 0; gap: 10px;
        }

        /* ── Message list panel ── */
        .panel-list {
          width: 340px; min-width: 340px; height: 100%;
          flex-shrink: 0; overflow: hidden;
        }
        /* Thread collapsed → list fills all remaining space */
        .panel-list--expanded {
          width: auto !important; min-width: 0 !important;
          flex: 1 !important;
        }

        /* ── Thread panel ── */
        .panel-thread {
          flex: 1; min-width: 0; height: 100%; overflow: hidden;
          border-left: 1px solid #F0F1F3;
        }

        /* ── Expand strip (thin button at right edge when collapsed) ── */
        /* Desktop only — hidden on tablet/mobile */
        .thread-expand-strip {
          display: flex; flex-shrink: 0;
          width: 20px; height: 100%;
          align-items: center; justify-content: center;
          background: #F8F9FB; border: none;
          border-left: 1px solid #F0F1F3;
          cursor: pointer; color: #9CA3AF;
          transition: background 0.15s, color 0.15s;
        }
        .thread-expand-strip:hover { background: #F0F1F3; color: #374151; }

        /* ── Mobile FAB ── */
        .mobile-fab {
          position: fixed; bottom: 22px; right: 22px;
          width: 52px; height: 52px; border-radius: 50%;
          background: #D4AF37; border: none; cursor: pointer;
          display: none; align-items: center; justify-content: center;
          box-shadow: 0 4px 18px rgba(212,175,55,0.4); z-index: 100;
          transition: background 0.15s, transform 0.15s;
        }
        .mobile-fab:hover  { background: #B8962E; transform: scale(1.06); }
        .mobile-fab:active { transform: scale(0.95); }
        .mobile-fab--hidden { display: none !important; }

        /* ── Tablet (901–1024 px): hide thread, list fills ── */
        @media (max-width: 900px) {
          .panel-thread        { display: none !important; }
          .thread-expand-strip { display: none !important; }
          .panel-list--expanded { flex: 1 !important; width: auto !important; min-width: 0 !important; }
        }

        /* ── Mobile (≤640 px) ── */
        @media (max-width: 640px) {
          .mb-topbar  { display: flex !important; }
          .mobile-fab { display: flex !important; }
          /* List: full width */
          .panel-list { width: 100% !important; min-width: 0 !important; }
          .panel-list--hidden   { display: none !important; }
          .panel-list--expanded { flex: 1 !important; }
          /* Thread: absolute overlay */
          .panel-thread {
            display: none !important;
            position: absolute; inset: 0; z-index: 10; border-left: none;
          }
          .panel-thread--active { display: flex !important; flex-direction: column; }
          .thread-expand-strip  { display: none !important; }
        }
      `}</style>
    </div>
  )
}


function normalizeRealtimeMessage(raw, recipientRow = null) {
  return {
    id:             raw.id,
    messageId:      raw.id,
    threadId:       raw.thread_id,
    thread_id:      raw.thread_id,
    senderId:       raw.sender_id,
    sender_id:      raw.sender_id,
    senderName:     raw.profiles?.name     || 'Unknown',
    senderEmail:    raw.profiles?.email    || '',
    senderRole:     raw.profiles?.role     || '',
    senderInitials: raw.profiles?.initials || '',
    senderAvatar:   null,
    subject:        raw.subject || '(no subject)',
    preview:        (raw.body || '').replace(/<[^>]+>/g, '').slice(0, 120),
    body:           raw.body || '',
    timestamp:      raw.created_at,
    created_at:     raw.created_at,
    is_read:        false,
    is_starred:     false,
    isPriority:     raw.is_priority || false,
    is_priority:    raw.is_priority || false,
    folder:         recipientRow?.folder || 'inbox',
    labels:         [],
    attachments:    [],
    auditLog:       [],
    
    recipientRowId: recipientRow?.id || null,
  }
}

export function MailboxPage({ currentUser, onSignOut }) {
  return (
    <MailboxProvider currentUser={currentUser}>
      <MailboxInner currentUser={currentUser} onSignOut={onSignOut} />
    </MailboxProvider>
  )
}
