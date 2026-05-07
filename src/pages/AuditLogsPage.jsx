import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Search, RefreshCw, Shield } from 'lucide-react'
import { supabase } from '../services/supabase'
import { AvatarInitials } from '../components/AvatarInitials'
import { formatTime } from '../utils/time'

const ACTION_LABELS = {
  sent: { label: 'Sent', color: '#2563EB', bg: '#DBEAFE' },
  opened: { label: 'Opened', color: '#065F46', bg: '#D1FAE5' },
  replied: { label: 'Replied', color: '#5B21B6', bg: '#EDE9FE' },
  archived: { label: 'Archived', color: '#92400E', bg: '#FEF3C7' },
  deleted: { label: 'Deleted', color: '#991B1B', bg: '#FEE2E2' },
  draft_saved: { label: 'Draft', color: '#374151', bg: '#F3F4F6' },
  starred: { label: 'Starred', color: '#D97706', bg: '#FEF3C7' },
  forwarded: { label: 'Forwarded', color: '#0369A1', bg: '#F0F9FF' },
  role_broadcast: { label: 'Broadcast', color: '#6D28D9', bg: '#EDE9FE' },
}

function ActionBadge({ action }) {
  const cfg = ACTION_LABELS[action] || { label: action, color: '#374151', bg: '#F3F4F6' }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

export function AuditLogsPage({ currentUser, onBack }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          id, action, metadata, created_at,
          profiles!actor_id ( id, name, email, role, initials ),
          messages ( id, subject )
        `)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction)
      }

      const { data, error } = await query
      if (error) throw error
      setLogs(page === 0 ? data : prev => [...prev, ...data])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filterAction, page])

  useEffect(() => {
    setPage(0)
    setLogs([])
  }, [filterAction])

  useEffect(() => { loadLogs() }, [loadLogs])

  const filtered = logs.filter(log => {
    if (!search) return true
    const actor = log.profiles?.name || ''
    const subject = log.messages?.subject || ''
    const meta = JSON.stringify(log.metadata || {})
    return actor.toLowerCase().includes(search.toLowerCase()) ||
      subject.toLowerCase().includes(search.toLowerCase()) ||
      meta.toLowerCase().includes(search.toLowerCase())
  })

  const actionCounts = logs.reduce((acc, l) => ({ ...acc, [l.action]: (acc[l.action] || 0) + 1 }), {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif', background: '#F8F9FB' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F0F1F3', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 34, height: 34, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Shield size={18} color="#5B21B6" />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>Audit Logs</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>SuperAdmin only · Full activity trail</div>
          </div>
        </div>
        <button onClick={() => { setPage(0); setLogs([]); loadLogs() }} title="Refresh" style={{ width: 34, height: 34, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}>
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Action filter */}
      <div style={{ padding: '12px 24px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
        {[{ value: 'all', label: 'All', count: logs.length }, ...Object.keys(ACTION_LABELS).map(a => ({ value: a, label: ACTION_LABELS[a].label, count: actionCounts[a] || 0 }))].filter(f => f.count > 0 || f.value === 'all').map(f => (
          <button
            key={f.value}
            onClick={() => setFilterAction(f.value)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: filterAction === f.value ? '#F5E9B8' : '#fff', color: filterAction === f.value ? '#7A5A00' : '#374151', fontSize: 12, fontWeight: filterAction === f.value ? 600 : 500, cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s' }}
          >
            {f.label}
            {f.count > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: 20 }}>{f.count}</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '0 24px 12px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by actor, subject, or metadata…"
            style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#111', outline: 'none', background: '#fff', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = '#D4AF37'}
            onBlur={e => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>
      </div>

      {/* Logs table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        {loading && logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF', fontSize: 13 }}>Loading logs…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF', fontSize: 13 }}>No log entries found</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {filtered.map(log => {
              const actor = log.profiles
              const metadata = log.metadata || {}
              const metaType = metadata.type

              return (
                <div key={log.id} style={{ background: '#fff', border: '1px solid #F0F1F3', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <AvatarInitials name={actor?.name || '?'} initials={actor?.initials} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{actor?.name || 'Unknown'}</span>
                      <span style={{ fontSize: 11, color: '#6B7280' }}>{actor?.role}</span>
                      <ActionBadge action={log.action} />
                      {metaType && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: '#EDE9FE', color: '#5B21B6' }}>{metaType.replace(/_/g, ' ')}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {log.messages?.subject ? <>Re: <em style={{ color: '#374151' }}>{log.messages.subject}</em></> : metaType === 'user_created' ? <>Created user <em style={{ color: '#374151' }}>{metadata.target_email}</em> as <strong>{metadata.assigned_role}</strong></> : metaType === 'user_edited' ? <>Edited user · new role: <strong>{metadata.new_role}</strong></> : <span style={{ color: '#9CA3AF' }}>System action</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0, textAlign: 'right' }}>
                    <div>{formatTime(log.created_at)}</div>
                    <div style={{ fontSize: 10, marginTop: 2 }}>{new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</div>
                  </div>
                </div>
              )
            })}

            {filtered.length >= PAGE_SIZE && (
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={loading}
                style={{ padding: '10px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151' }}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
