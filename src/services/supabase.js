// src/services/supabase.js
import { createClient } from '@supabase/supabase-js'
import { createRateLimiter } from '../utils/rateLimiter'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
})

const RATE_LIMIT = parseInt(import.meta.env.VITE_RATE_LIMIT_PER_MINUTE || '10', 10)
const sendLimiter = createRateLimiter(RATE_LIMIT, 60_000)

// ── Folder constants ─────────────────────────────────────────
export const FOLDER = {
  INBOX:   'inbox',
  SENT:    'sent',
  TRASH:   'trash',
  ARCHIVE: 'archive',
  STARRED: 'starred',
  DELETED: 'deleted_permanently',
}

// ── Auth ─────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ── Profiles ─────────────────────────────────────────────────
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

// ── Messages — per-user, composite-cursor pagination ─────────
export async function fetchMessages({ folder, userId, userRole = null, cursor = null, limit = 30 }) {
  if (!userId) throw new Error('fetchMessages: userId is required')

  // FIX: use messages!inner(...).is_deleted=eq.false via select filter syntax
  // instead of .eq('messages.is_deleted', false) which is invalid in PostgREST
  const selectFields = folder === FOLDER.TRASH
    ? `
      id, folder, is_read, is_starred, delivery_status, created_at,
      messages!inner (
        id, thread_id, subject, body, is_priority, created_at, sender_id, is_deleted,
        profiles!sender_id ( id, name, email, role, initials, avatar_url ),
        attachments ( id, name, size_bytes, mime_type )
      )
    `
    : `
      id, folder, is_read, is_starred, delivery_status, created_at,
      messages!inner (
        id, thread_id, subject, body, is_priority, created_at, sender_id, is_deleted,
        profiles!sender_id ( id, name, email, role, initials, avatar_url ),
        attachments ( id, name, size_bytes, mime_type )
      )
    `

  const recipientFilter = userRole
    ? `recipient_id.eq.${userId},recipient_role.eq.${userRole}`
    : `recipient_id.eq.${userId}`

  let query = supabase
    .from('message_recipients')
    .select(selectFields)
    .or(recipientFilter)
    .eq('folder', folder)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  // FIX: filter is_deleted on the join using PostgREST embedded filter syntax
  if (folder !== FOLDER.TRASH) {
    query = query.eq('messages.is_deleted', false)
  }

  // Composite cursor
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.timestamp},` +
      `and(created_at.eq.${cursor.timestamp},id.lt.${cursor.id})`
    )
  }

  const { data, error } = await query
  if (error) throw error

  // Client-side filter as safety net for is_deleted
  return (data || []).filter(r => {
    if (!r.messages) return false
    if (folder !== FOLDER.TRASH && r.messages.is_deleted) return false
    return true
  })
}

// ── Fetch single message (realtime use) ──────────────────────
export async function fetchMessageById(messageId, userId, userRole = null) {
  if (!userId) throw new Error('fetchMessageById: userId is required')

  const selectFields = `
    id, folder, is_read, is_starred, delivery_status,
    messages!inner (
      id, thread_id, subject, body, is_priority, created_at, sender_id,
      profiles!sender_id ( id, name, email, role, initials, avatar_url )
    )
  `

  // Try by recipient_id first
  const { data, error } = await supabase
    .from('message_recipients')
    .select(selectFields)
    .eq('message_id', messageId)
    .eq('recipient_id', userId)
    .maybeSingle()

  if (error) throw error

  // Fallback: try by recipient_role (for broadcast messages)
  let row = data
  if (!row && userRole) {
    const { data: roleData, error: roleError } = await supabase
      .from('message_recipients')
      .select(selectFields)
      .eq('message_id', messageId)
      .eq('recipient_role', userRole)
      .maybeSingle()

    if (roleError) throw roleError
    row = roleData
  }

  if (!row) return null

  return {
    ...row.messages,
    _recipientRow: {
      id:              row.id,
      folder:          row.folder,
      is_read:         row.is_read,
      is_starred:      row.is_starred,
      delivery_status: row.delivery_status,
    },
  }
}

// ── Fetch full thread ─────────────────────────────────────────
export async function fetchThread(threadId) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, thread_id, subject, body, is_priority, created_at,
      profiles!sender_id ( id, name, email, role, initials, avatar_url ),
      attachments ( id, name, size_bytes, mime_type, storage_path ),
      message_labels ( labels ( id, name, color ) )
    `)
    .eq('thread_id', threadId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// ── Send message ──────────────────────────────────────────────
export async function sendMessage({ subject, body, recipients, threadId = null, isPriority = false, idempotencyKey }) {
  if (!sendLimiter.canProceed()) {
    const err = new Error(`Rate limit reached. Max ${RATE_LIMIT} messages/minute. Please wait.`)
    err.code = 'RATE_LIMITED'
    throw err
  }

  const { data: { user } } = await supabase.auth.getUser()
  const senderId = user.id

  const hasBroadcastRecipient = recipients.some(r => 'role' in r)
  if (hasBroadcastRecipient) {
    const { data: senderProfile } = await supabase
      .from('profiles').select('role').eq('id', senderId).single()
    const { data: appRoles } = await supabase
      .from('app_roles').select('name,can_broadcast,is_super_admin')
    const senderRole = appRoles?.find(r => r.name === senderProfile?.role)
    if (!senderRole?.can_broadcast && !senderRole?.is_super_admin) {
      throw new Error('Forbidden: insufficient permissions to send to roles or broadcast')
    }
  }

  let tId = threadId
  if (!tId) {
    const { data: thread, error: tErr } = await supabase
      .from('threads').insert({ subject, created_by: senderId }).select('id').single()
    if (tErr) throw tErr
    tId = thread.id
  }

  const { data: msg, error: mErr } = await supabase
    .from('messages')
    .upsert(
      { thread_id: tId, sender_id: senderId, subject, body, is_priority: isPriority, idempotency_key: idempotencyKey },
      { onConflict: 'idempotency_key', ignoreDuplicates: false }
    )
    .select('id')
    .single()
  if (mErr) throw mErr

  const { count } = await supabase
    .from('message_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('message_id', msg.id)
  if (count > 0) return { id: msg.id, threadId: tId, isDuplicate: true }

  const recipientRows = recipients.map(r => ({
    message_id: msg.id,
    ...(r.userId ? { recipient_id: r.userId } : { recipient_role: r.role }),
    folder:          FOLDER.INBOX,
    delivery_status: 'delivered',
    is_read:         r.userId === senderId,
  }))

  if (!recipients.some(r => r.userId === senderId)) {
    recipientRows.push({
      message_id:      msg.id,
      recipient_id:    senderId,
      folder:          FOLDER.SENT,
      delivery_status: 'delivered',
      is_read:         true,
    })
  }

  const { error: rErr } = await supabase.from('message_recipients').insert(recipientRows)
  if (rErr) throw rErr

  // Fire-and-forget audit log — never block send on this
  supabase.from('audit_logs')
    .insert({ message_id: msg.id, actor_id: senderId, action: 'sent' })
    .then(({ error: aErr }) => { if (aErr) console.warn('audit_logs:', aErr.message) })

  return { id: msg.id, threadId: tId }
}

// ── Delete message + attachments in storage (rollback helper) ─
export async function deleteMessageWithAttachments(messageId) {
  const { data: attachments } = await supabase
    .from('attachments').select('storage_path').eq('message_id', messageId)

  if (attachments?.length) {
    await supabase.storage
      .from(import.meta.env.VITE_STORAGE_BUCKET || 'mailbox-attachments')
      .remove(attachments.map(a => a.storage_path))
  }

  await supabase.from('messages').delete().eq('id', messageId)
}

// ── Mark read / unread ────────────────────────────────────────
export async function markRead(recipientRowId, isRead) {
  if (!recipientRowId) throw new Error('markRead: recipientRowId is required')
  const { error } = await supabase
    .from('message_recipients')
    .update({
      is_read:         isRead,
      read_at:         isRead ? new Date().toISOString() : null,
      delivery_status: isRead ? 'read' : 'delivered',
    })
    .eq('id', recipientRowId)
  if (error) throw error
}

// ── Move to folder / permanent delete ────────────────────────
export async function moveToFolder(recipientRowId, folder, messageId) {
  if (!recipientRowId) throw new Error('moveToFolder: recipientRowId is required')

  if (folder === 'deleted') {
    const { data: deleted, error: delErr } = await supabase
      .from('message_recipients')
      .delete()
      .eq('id', recipientRowId)
      .select('id')
    if (delErr) throw delErr

    if (!Array.isArray(deleted) || deleted.length === 0) {
      const { error: updErr } = await supabase
        .from('message_recipients')
        .update({ folder: FOLDER.DELETED })
        .eq('id', recipientRowId)
      if (updErr) throw updErr
    }
    return
  }

  const { error } = await supabase
    .from('message_recipients')
    .update({ folder })
    .eq('id', recipientRowId)
  if (error) throw error

  if (folder === FOLDER.TRASH) {
    supabase.auth.getUser().then(({ data: { user } }) => {
      supabase.from('audit_logs')
        .insert({ message_id: messageId, actor_id: user.id, action: 'moved_to_trash' })
        .then(({ error: aErr }) => { if (aErr) console.warn('audit_logs trash:', aErr.message) })
    })
  }
}

// ── Toggle star ───────────────────────────────────────────────
export async function toggleStar(recipientRowId, isStarred) {
  if (!recipientRowId) throw new Error('toggleStar: recipientRowId is required')
  const { error } = await supabase
    .from('message_recipients')
    .update({ is_starred: isStarred })
    .eq('id', recipientRowId)
  if (error) throw error
}

// ── Upload attachment ─────────────────────────────────────────
export async function uploadAttachment(messageId, file) {
  const path = `attachments/${messageId}/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage
    .from(import.meta.env.VITE_STORAGE_BUCKET || 'mailbox-attachments')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (uploadError) throw uploadError

  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase.from('attachments').insert({
    message_id:   messageId,
    name:         file.name,
    size_bytes:   file.size,
    mime_type:    file.type,
    storage_path: path,
    uploaded_by:  user.id,
  }).select('id').single()
  if (error) throw error
  return data
}

// ── Unread counts ─────────────────────────────────────────────
export async function fetchUnreadCounts(userId, userRole = null) {
  if (!userId) return {}

  const recipientFilter = userRole
    ? `recipient_id.eq.${userId},recipient_role.eq.${userRole}`
    : `recipient_id.eq.${userId}`

  const { data, error } = await supabase
    .from('message_recipients')
    .select('folder')
    .or(recipientFilter)
    .eq('is_read', false)
  if (error) throw error

  const excluded = [FOLDER.TRASH, FOLDER.SENT, FOLDER.DELETED]
  return (data || [])
    .filter(row => !excluded.includes(row.folder))
    .reduce((acc, row) => {
      acc[row.folder] = (acc[row.folder] || 0) + 1
      return acc
    }, {})
}

// ── Audit logs ────────────────────────────────────────────────
export async function fetchAuditLogs(messageId) {
  const { data, error } = await supabase
    .from('audit_logs').select('*, profiles!actor_id ( name, role )')
    .eq('message_id', messageId).order('created_at', { ascending: true })
  if (error) throw error
  return data
}

// ── Profile search ────────────────────────────────────────────
export async function searchProfiles(query, roleFilter) {
  let q = supabase.from('profiles')
    .select('id, name, email, role, initials, department')
    .eq('is_active', true).order('name').limit(20)
  if (roleFilter) q = q.eq('role', roleFilter)
  if (query) q = q.or(`name.ilike.%${query}%,email.ilike.%${query}%`)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function fetchProfilesByRole(role) {
  const { data, error } = await supabase.from('profiles')
    .select('id, name, email, role, initials, department')
    .eq('role', role).eq('is_active', true).order('name')
  if (error) throw error
  return data
}

// ── Password change ───────────────────────────────────────────
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ── Admin: roles, labels, departments ────────────────────────
export async function fetchAppRoles() {
  const { data, error } = await supabase.from('app_roles').select('*').order('name')
  if (error) throw error
  return data
}
export async function createAppRole(payload) {
  const { data, error } = await supabase.from('app_roles').insert(payload).select().single()
  if (error) throw error
  return data
}
export async function deleteAppRole(id) {
  const { error } = await supabase.from('app_roles').delete().eq('id', id)
  if (error) throw error
}

export async function fetchAppLabels() {
  const { data, error } = await supabase.from('app_labels').select('*').order('name')
  if (error) throw error
  return data
}
export async function createAppLabel(payload) {
  const { data, error } = await supabase.from('app_labels').insert(payload).select().single()
  if (error) throw error
  return data
}
export async function deleteAppLabel(id) {
  const { error } = await supabase.from('app_labels').delete().eq('id', id)
  if (error) throw error
}

export async function fetchDepartments() {
  const { data, error } = await supabase.from('departments').select('id, name').order('name')
  if (error) throw error
  return data
}
export async function createDepartment(name) {
  const { data, error } = await supabase.from('departments').insert({ name }).select().single()
  if (error) throw error
  return data
}
export async function deleteDepartment(id) {
  const { error } = await supabase.from('departments').delete().eq('id', id)
  if (error) throw error
}

// ── Admin user operations via Edge Function ───────────────────
export async function adminCreateUser({ email, password, name, role, department }) {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ email, password, name, role, department }),
  })
  if (!res.ok) throw new Error((await res.text()) || 'Failed to create user')
  return res.json()
}

export async function adminDeleteUser(userId) {
  const session = await getSession()
  if (!session) throw new Error('Not authenticated')
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-delete-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) throw new Error((await res.text()) || 'Failed to delete user')
  return res.json()
}