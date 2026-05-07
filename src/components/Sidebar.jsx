import { useState, useCallback, memo } from 'react'
import {
  Inbox, Send, FileText, Star, Trash2, Archive,
  Users, Settings, X, Bell, Tag, ChevronDown, ChevronRight, Shield,
} from 'lucide-react'
import { useMailbox } from '../context/MailboxContext'
import { AvatarInitials } from './AvatarInitials'

const FOLDERS = [
  { id: 'inbox',   label: 'Inbox',   icon: Inbox },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'sent',    label: 'Sent',    icon: Send },
  { id: 'drafts',  label: 'Drafts',  icon: FileText },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'trash',   label: 'Trash',   icon: Trash2 },
]

// Fallback color for roles not found in appRoles
const ROLE_COLOR_FALLBACK = { bg: '#F3F4F6', text: '#374151' }

// ── Memoized nav item ─────────────────────────────────────────
const NavItem = memo(function NavItem({ id, label, Icon, isActive, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
        borderRadius: 6, cursor: 'pointer', width: '100%', border: 'none',
        background: isActive ? '#F5E9B8' : 'transparent',
        color: isActive ? '#7A5A00' : '#374151',
        fontWeight: isActive ? 600 : 500, fontSize: 13,
        transition: 'background 0.12s, color 0.12s',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F8F9FB' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {badge > 0 && (
        <span style={{
          background: '#D4AF37', color: '#111', fontSize: 10, fontWeight: 700,
          minWidth: 18, height: 18, borderRadius: 9, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '0 5px',
        }}>{badge}</span>
      )}
    </button>
  )
})

function RolePill({ role, appRoles = [] }) {
  const found = appRoles.find(r => r.name === role)
  const c = found ? { bg: found.color_bg, text: found.color_text } : ROLE_COLOR_FALLBACK
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: c.bg, color: c.text, letterSpacing: '0.04em',
    }}>{role}</span>
  )
}

export function Sidebar({ currentUser, onCompose, isMobileOpen, onMobileClose, onUserManagement, onAuditLogs, onOpenProfile }) {
  const { activeFolder, unreadCounts, setFolder } = useMailbox()
  const [rolesExpanded, setRolesExpanded] = useState(true)
  const [labelsExpanded, setLabelsExpanded] = useState(true)
  const permissions = currentUser?.permissions || {}
  const appRoles = currentUser?.appRoles || []
  const appLabels = currentUser?.appLabels || []
  const canManageUsers = permissions.canManageUsers || false
  const canViewAuditLogs = permissions.canViewAuditLogs || false
  const canViewOrgInfo = permissions.canViewOrgInfo || false

  const handleFolderClick = useCallback((folderId) => {
    setFolder(folderId)
    onMobileClose?.()
  }, [setFolder, onMobileClose])

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif' }}>
      {/* Brand header */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #F0F1F3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMobileOpen && (
            <button onClick={onMobileClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginRight: 4 }}>
              <X size={18} color="#6B7280" />
            </button>
          )}
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #D4AF37 0%, #B8962E 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#111', flexShrink: 0,
          }}>G8</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.2 }}>Glory8</div>
            <div style={{ fontSize: 10, color: '#6B7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Mailbox</div>
          </div>
        </div>
      </div>

      {/* Compose button — hidden in trash (Gmail-style) */}
      {activeFolder !== 'trash' && (
      <button
        onClick={onCompose}
        style={{
          margin: '14px 12px 10px', background: '#D4AF37', color: '#111',
          border: 'none', borderRadius: 6, padding: '9px 14px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#B8962E'}
        onMouseLeave={e => e.currentTarget.style.background = '#D4AF37'}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 5H5a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-7"/>
          <path d="M17.5 3.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z"/>
        </svg>
        Compose
      </button>
      )}

      {/* Folders */}
      <div style={{ padding: '8px 8px 4px', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '0 8px 6px' }}>
          Folders
        </div>
        {FOLDERS.map(({ id, label, icon: Icon }) => (
          <NavItem
            key={id}
            id={id}
            label={label}
            Icon={Icon}
            isActive={activeFolder === id}
            badge={unreadCounts[id] || 0}
            onClick={() => handleFolderClick(id)}
          />
        ))}

        {/* Roles + Labels — HR and above only */}
        {canViewOrgInfo && (
          <>
            <div style={{ height: 1, background: '#F0F1F3', margin: '8px 8px' }} />

            {/* Roles section */}
            <button
              onClick={() => setRolesExpanded(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 6px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase', border: 'none', background: 'none', cursor: 'pointer', width: '100%' }}
            >
              {rolesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Roles
            </button>
            {rolesExpanded && appRoles.map(r => (
              <button
                key={r.id}
                onClick={() => handleFolderClick('inbox')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8F9FB'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <RolePill role={r.name} appRoles={appRoles} />
                <span style={{ fontSize: 12, color: '#6B7280' }}>Messages</span>
              </button>
            ))}

            <div style={{ height: 1, background: '#F0F1F3', margin: '8px 8px' }} />

            {/* Labels section */}
            <button
              onClick={() => setLabelsExpanded(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 6px', fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase', border: 'none', background: 'none', cursor: 'pointer', width: '100%' }}
            >
              {labelsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Labels
            </button>
            {labelsExpanded && appLabels.map(label => (
              <button
                key={label.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, transition: 'background 0.12s', fontSize: 13, color: '#374151' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8F9FB'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: label.color, flexShrink: 0 }} />
                {label.name}
              </button>
            ))}
          </>
        )}

        {/* Admin tools */}
        {(canManageUsers || canViewAuditLogs) && (
          <>
            <div style={{ height: 1, background: '#F0F1F3', margin: '8px 8px' }} />
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '0 8px 6px' }}>Admin</div>
            {canManageUsers && (
              <NavItem id="users" label="User Management" Icon={Users} isActive={false} onClick={() => { onUserManagement?.(); onMobileClose?.() }} />
            )}
            {canViewAuditLogs && (
              <NavItem id="audit" label="Audit Logs" Icon={Shield} isActive={false} onClick={() => { onAuditLogs?.(); onMobileClose?.() }} />
            )}
          </>
        )}
      </div>

      {/* Realtime indicator + User row */}
      <div style={{ padding: 12, borderTop: '1px solid #F0F1F3' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '0 4px' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#059669',
            display: 'inline-block', animation: 'pulse 2s infinite',
          }} />
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
          <span style={{ fontSize: 11, color: '#6B7280' }}>Realtime connected</span>
        </div>
        {currentUser && (
          <button
            onClick={onOpenProfile}
            title="Account settings"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 6, cursor: 'pointer', transition: 'background 0.12s', width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F8F9FB'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <AvatarInitials name={currentUser.name} color={currentUser.color} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser.name}
              </div>
              <RolePill role={currentUser.role} appRoles={appRoles} />
            </div>
            <Settings size={14} color="#9CA3AF" />
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="sidebar-desktop" style={{ width: 240, minWidth: 240, height: '100%', background: '#fff', borderRight: '1px solid #F0F1F3', flexShrink: 0 }}>
        {sidebarContent}
      </div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}
          onClick={onMobileClose}
        >
          <div
            style={{ width: 280, height: '100%', background: '#fff', boxShadow: '4px 0 20px rgba(0,0,0,0.12)' }}
            onClick={e => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
        </div>
      )}
    </>
  )
}
