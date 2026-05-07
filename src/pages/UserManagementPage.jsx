// src/pages/UserManagementPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Search, Plus, Edit2, UserX, UserCheck, X, AlertTriangle, Check, Tag, Shield, Trash2, Settings } from 'lucide-react'
import { supabase, adminCreateUser, adminDeleteUser } from '../services/supabase'
import {
  fetchAppRoles, createAppRole, deleteAppRole,
  fetchAppLabels, createAppLabel, deleteAppLabel,
  fetchDepartments, createDepartment, deleteDepartment,
} from '../services/supabase'
import { AvatarInitials } from '../components/AvatarInitials'
import { can } from '../utils/rbac'

const ROLE_COLOR_DEFAULT = { bg: '#F3F4F6', text: '#374151' }

function RolePill({ role, appRoles = [] }) {
  const dyn = appRoles.find(r => r.name === role)
  const c = dyn ? { bg: dyn.color_bg, text: dyn.color_text } : ROLE_COLOR_DEFAULT
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: c.bg, color: c.text, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {role}
    </span>
  )
}

function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t) }, [onDismiss])
  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 24, zIndex: 9999,
      background: type === 'success' ? '#ECFDF5' : '#FEF2F2',
      border: `1px solid ${type === 'success' ? '#6EE7B7' : '#FECACA'}`,
      color: type === 'success' ? '#065F46' : '#DC2626',
      borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 13, fontWeight: 500,
    }}>
      <style>{`@keyframes slide-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      {type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
      {message}
    </div>
  )
}

// ── Create/Edit User Modal ────────────────────────────────────
function UserModal({ mode, user, currentUserRole, appRoles, departments, onClose, onSaved, setToast }) {
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [role, setRole] = useState(user?.role || 'User')
  const [department, setDepartment] = useState(user?.department || '')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const roleOptions = appRoles.map(r => r.name)
  const canAssignRole = (r) => {
    // SuperAdmin can assign any role
    const currentRoleObj = appRoles.find(ar => ar.name === currentUserRole)
    if (currentRoleObj?.is_super_admin) return true
    // Admin/manage_users can assign any non-super-admin role
    if (currentRoleObj?.can_manage_users) {
      const targetRoleObj = appRoles.find(ar => ar.name === r)
      return !targetRoleObj?.is_super_admin
    }
    return false
  }

  const handleSave = async () => {
    setError(null)
    if (!name.trim()) { setError('Name is required'); return }
    if (!email.trim()) { setError('Email is required'); return }
    if (mode === 'create' && !password.trim()) { setError('Password is required'); return }
    const initials = name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    setLoading(true)
    try {
      if (mode === 'create') {
        // FIX #2: adminCreateUser calls Edge Function — service role key stays server-side
        await adminCreateUser({
          email:      email.trim(),
          password,
          name:       name.trim(),
          role:       role || 'User',
          department: department.trim() || null,
        })

        const { data: { user: actor } } = await supabase.auth.getUser()
        await supabase.from('audit_logs').insert({
          actor_id: actor.id, action: 'sent',
          metadata: { type: 'user_created', target_email: email.trim(), assigned_role: role },
        })
      } else {
        const { error: profileError } = await supabase.from('profiles').update({
          name: name.trim(), role, department: department.trim() || null, initials,
        }).eq('id', user.id)
        if (profileError) throw profileError
        const { data: { user: actor } } = await supabase.auth.getUser()
        await supabase.from('audit_logs').insert({
          actor_id: actor.id, action: 'sent',
          metadata: { type: 'user_edited', target_id: user.id, new_role: role },
        })
      }
      onSaved()
    } catch (err) {
      setError(err.message || 'Operation failed')
    } finally { setLoading(false) }
  }

  const inputStyle = { width: '100%', padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13.5, fontFamily: 'Inter, sans-serif', color: '#111', outline: 'none', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)', fontFamily: 'Inter, sans-serif' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: 480, maxWidth: '95vw', overflow: 'hidden', animation: 'modal-in 0.2s ease' }}>
        <style>{`@keyframes modal-in{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:none}}`}</style>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F1F3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{mode === 'create' ? 'Add New User' : 'Edit User'}</div>
          <button onClick={onClose} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Full Name</label>
            <input style={inputStyle} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Budi Santoso"
              onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Email</label>
            <input style={{ ...inputStyle, background: mode === 'edit' ? '#F8F9FB' : '#fff', opacity: mode === 'edit' ? 0.7 : 1 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@glory8.com" disabled={mode === 'edit'}
              onFocus={e => { if (mode !== 'edit') e.target.style.borderColor = '#D4AF37' }} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
          </div>
          {mode === 'create' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Password</label>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters"
                onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Department</label>
            <select style={{ ...inputStyle, background: '#fff', cursor: 'pointer', color: department ? '#111' : '#9CA3AF' }}
              value={department} onChange={e => setDepartment(e.target.value)}
              onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#E5E7EB'}>
              <option value="">— No department —</option>
              {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Role</label>
            <select style={{ ...inputStyle, background: '#fff', cursor: 'pointer' }}
              value={role} onChange={e => setRole(e.target.value)}
              onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#E5E7EB'}>
              {roleOptions.filter(canAssignRole).map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {error && (
            <div style={{ padding: '8px 12px', background: '#FEF2F2', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#DC2626' }}>
              <AlertTriangle size={13} />{error}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #F0F1F3', display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#F8F9FB' }}>
          <button onClick={onClose} style={{ padding: '7px 14px', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: 'transparent', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#374151' }}>Cancel</button>
          <button onClick={handleSave} disabled={loading}
            style={{ padding: '7px 16px', border: 'none', borderRadius: 6, background: loading ? '#E5E7EB' : '#D4AF37', color: loading ? '#9CA3AF' : '#111', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Saving…' : mode === 'create' ? 'Create User' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SuperAdmin Settings Panel ─────────────────────────────────
function SettingsPanel({ setToast }) {
  const [tab, setTab] = useState('roles')
  const [appRoles, setAppRoles] = useState([])
  const [appLabels, setAppLabels] = useState([])
  const [departments, setDepartments] = useState([])
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6B7280')
  const [newBg, setNewBg] = useState('#F3F4F6')
  const [newPerms, setNewPerms] = useState({
    can_broadcast: false, can_manage_users: false, can_view_org_info: false,
    can_view_audit: false, is_super_admin: false,
  })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    const [r, l, d] = await Promise.all([fetchAppRoles(), fetchAppLabels(), fetchDepartments()])
    setAppRoles(r); setAppLabels(l); setDepartments(d)
  }, [])
  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      if (tab === 'roles') await createAppRole({
          name: newName.trim(),
          color_bg: newBg,
          color_text: newColor,
          can_broadcast: newPerms.can_broadcast,
          can_manage_users: newPerms.can_manage_users,
          can_view_org_info: newPerms.can_view_org_info,
          can_view_audit: newPerms.can_view_audit,
          is_super_admin: newPerms.is_super_admin,
        })
      else if (tab === 'labels') await createAppLabel({ name: newName.trim(), color: newColor })
      else await createDepartment(newName.trim())
      setNewName(''); setNewColor('#6B7280'); setNewBg('#F3F4F6'); setNewPerms({ can_broadcast: false, can_manage_users: false, can_view_org_info: false, can_view_audit: false, is_super_admin: false })
      await load()
      setToast({ message: `${tab === 'roles' ? 'Role' : tab === 'labels' ? 'Label' : 'Department'} added`, type: 'success' })
    } catch (err) { setToast({ message: err.message, type: 'error' }) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    try {
      if (tab === 'roles') await deleteAppRole(id)
      else if (tab === 'labels') await deleteAppLabel(id)
      else await deleteDepartment(id)
      await load()
      setToast({ message: 'Deleted', type: 'success' })
    } catch (err) { setToast({ message: err.message, type: 'error' }) }
  }

  const items = tab === 'roles' ? appRoles : tab === 'labels' ? appLabels : departments
  const tabBtn = (key, label, Icon) => (
    <button onClick={() => setTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px', fontSize: 12.5, fontWeight: tab === key ? 600 : 500, color: tab === key ? '#111' : '#6B7280', border: 'none', background: 'none', cursor: 'pointer', borderBottom: tab === key ? '2px solid #D4AF37' : '2px solid transparent' }}>
      <Icon size={12} />{label}
    </button>
  )

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 2 }}>System Settings</div>
      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Manage roles, labels, and departments. Only SuperAdmin can make changes.</div>
      <div style={{ display: 'flex', borderBottom: '1px solid #F0F1F3', marginBottom: 20 }}>
        {tabBtn('roles', 'Roles', Shield)}
        {tabBtn('labels', 'Labels', Tag)}
        {tabBtn('departments', 'Departments', Settings)}
      </div>

      {/* Add form */}
      <div style={{ background: '#F8F9FB', borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: '1px solid #F0F1F3' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
          Add {tab === 'roles' ? 'Role' : tab === 'labels' ? 'Label' : 'Department'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder={tab === 'roles' ? 'e.g. Manager' : tab === 'labels' ? 'e.g. Legal' : 'e.g. Procurement'}
              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #E5E7EB', borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
          </div>
          {tab !== 'departments' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>{tab === 'roles' ? 'Text Color' : 'Color'}</label>
              <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                style={{ width: 38, height: 36, border: '1.5px solid #E5E7EB', borderRadius: 7, cursor: 'pointer', padding: 2 }} />
            </div>
          )}
          {tab === 'roles' && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 4 }}>Background</label>
              <input type="color" value={newBg} onChange={e => setNewBg(e.target.value)}
                style={{ width: 38, height: 36, border: '1.5px solid #E5E7EB', borderRadius: 7, cursor: 'pointer', padding: 2 }} />
            </div>
          )}
          {tab !== 'departments' && newName && (
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              {tab === 'roles'
                ? <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: newBg, color: newColor }}>{newName}</span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: newColor }} />{newName}</span>
              }
            </div>
          )}
          {tab === 'roles' && (
            <div style={{ width: '100%', marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {[
                { key: 'is_super_admin',    label: 'Super Admin (full access)' },
                { key: 'can_broadcast',     label: 'Broadcast messages' },
                { key: 'can_manage_users',  label: 'Manage users' },
                { key: 'can_view_org_info', label: 'View org info' },
                { key: 'can_view_audit',    label: 'View audit logs' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newPerms[key]} onChange={e => setNewPerms(p => ({ ...p, [key]: e.target.checked }))}
                    style={{ accentColor: '#D4AF37', width: 14, height: 14 }} />
                  {label}
                </label>
              ))}
            </div>
          )}
          <button onClick={handleAdd} disabled={loading || !newName.trim()}
            style={{ padding: '8px 14px', background: (!newName.trim() || loading) ? '#E5E7EB' : '#D4AF37', color: (!newName.trim() || loading) ? '#9CA3AF' : '#111', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: (!newName.trim() || loading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 && <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 20 }}>No {tab} yet.</div>}
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #F0F1F3', borderRadius: 8, padding: '10px 14px' }}>
            {tab === 'roles' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: item.color_bg, color: item.color_text, flexShrink: 0 }}>{item.name}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {item.is_super_admin    && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: '#EDE9FE', color: '#5B21B6' }}>SuperAdmin</span>}
                  {item.can_broadcast     && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: '#D1FAE5', color: '#065F46' }}>Broadcast</span>}
                  {item.can_manage_users  && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: '#DBEAFE', color: '#1E40AF' }}>Manage Users</span>}
                  {item.can_view_org_info && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: '#FEF3C7', color: '#92400E' }}>Org Info</span>}
                  {item.can_view_audit    && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: '#F3F4F6', color: '#374151' }}>Audit</span>}
                </div>
              </div>
            )}
            {tab === 'labels' && <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#374151' }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />{item.name}</span>}
            {tab === 'departments' && <span style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{item.name}</span>}
            {tab !== 'roles' && <div style={{ flex: 1 }} />}
            <button onClick={() => handleDelete(item.id)}
              style={{ width: 28, height: 28, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9CA3AF' }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export function UserManagementPage({ currentUser, onBack }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [activePage, setActivePage] = useState('users')
  const [appRoles, setAppRoles] = useState([])
  const [departments, setDepartments] = useState([])

  const isSuperAdmin = currentUser?.permissions?.canManageRoles || false
  const canManage = currentUser?.permissions?.canManageUsers || false
  const roleOptions = appRoles.map(r => r.name)

  const loadMeta = useCallback(async () => {
    const [r, d] = await Promise.all([fetchAppRoles(), fetchDepartments()])
    setAppRoles(r); setDepartments(d)
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('profiles').select('id, name, email, role, department, initials, is_active, created_at').order('name')
      if (error) throw error
      setUsers(data)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadUsers(); loadMeta() }, [loadUsers, loadMeta])

  const handleToggleActive = async (user) => {
    try {
      await supabase.from('profiles').update({ is_active: !user.is_active }).eq('id', user.id)
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u))
      setToast({ message: `${user.name} ${user.is_active ? 'deactivated' : 'activated'}`, type: 'success' })
    } catch (err) { setToast({ message: err.message, type: 'error' }) }
  }

  const handleSaved = () => {
    const wasCreate = modal?.mode === 'create'
    setModal(null); loadUsers(); loadMeta()
    setToast({ message: wasCreate ? 'User created successfully' : 'User updated', type: 'success' })
  }

  const filtered = users.filter(u => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'all' || u.role === filterRole
    return matchSearch && matchRole
  })

  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    byRole: roleOptions.reduce((acc, r) => ({ ...acc, [r]: users.filter(u => u.role === r).length }), {}),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, sans-serif', background: '#F8F9FB' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #F0F1F3', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ width: 34, height: 34, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', flexShrink: 0 }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111' }}>User Management</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{stats.active} active · {stats.total} total</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isSuperAdmin && (
            <button onClick={() => setActivePage(p => p === 'settings' ? 'users' : 'settings')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: activePage === 'settings' ? '#F5E9B8' : 'transparent', color: activePage === 'settings' ? '#7A5A00' : '#6B7280', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Settings size={15} /> Settings
            </button>
          )}
          {canManage && activePage === 'users' && (
            <button onClick={() => setModal({ mode: 'create' })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#D4AF37', color: '#111', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Plus size={15} /> Add User
            </button>
          )}
        </div>
      </div>

      {activePage === 'settings' && isSuperAdmin ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <SettingsPanel setToast={setToast} />
        </div>
      ) : (
        <>
          {/* Role filter chips */}
          <div style={{ padding: '12px 24px 0', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
            {[{ label: 'All', value: 'all', count: stats.total }, ...roleOptions.map(r => ({ label: r, value: r, count: stats.byRole[r] || 0 }))].filter(s => s.count > 0 || s.value === 'all').map(s => (
              <button key={s.value} onClick={() => setFilterRole(s.value)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', background: filterRole === s.value ? '#F5E9B8' : '#fff', color: filterRole === s.value ? '#7A5A00' : '#374151', fontSize: 12, fontWeight: filterRole === s.value ? 600 : 500, cursor: 'pointer', flexShrink: 0 }}>
                {s.label}
                <span style={{ fontSize: 11, fontWeight: 700, background: filterRole === s.value ? 'rgba(0,0,0,0.1)' : '#F3F4F6', padding: '1px 5px', borderRadius: 20, color: 'inherit' }}>{s.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ padding: '12px 24px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
                style={{ width: '100%', padding: '9px 12px 9px 36px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, fontFamily: 'Inter, sans-serif', color: '#111', outline: 'none', background: '#fff', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#D4AF37'} onBlur={e => e.target.style.borderColor = '#E5E7EB'} />
            </div>
          </div>

          {/* User list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF', fontSize: 13 }}>Loading users…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9CA3AF', fontSize: 13 }}>No users found</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {filtered.map(user => (
                  <div key={user.id} style={{ background: '#fff', border: '1px solid #F0F1F3', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: user.is_active ? 1 : 0.6 }}>
                    <AvatarInitials name={user.name} initials={user.initials} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{user.name}</span>
                        <RolePill role={user.role} appRoles={appRoles} />
                        {!user.is_active && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: '#F3F4F6', color: '#6B7280' }}>Inactive</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}{user.department ? ` · ${user.department}` : ''}</div>
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setModal({ mode: 'edit', user })} title="Edit"
                          style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#F8F9FB'; e.currentTarget.style.color = '#111' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}>
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggleActive(user)} title={user.is_active ? 'Deactivate' : 'Activate'}
                          style={{ width: 32, height: 32, border: '1px solid rgba(0,0,0,0.08)', borderRadius: 6, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280' }}
                          onMouseEnter={e => { e.currentTarget.style.background = user.is_active ? '#FEF2F2' : '#ECFDF5'; e.currentTarget.style.color = user.is_active ? '#DC2626' : '#059669' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6B7280' }}>
                          {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {modal && (
        <UserModal mode={modal.mode} user={modal.user} currentUserRole={currentUser?.role}
          appRoles={appRoles} departments={departments}
          onClose={() => setModal(null)} onSaved={handleSaved} setToast={setToast} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  )
}
