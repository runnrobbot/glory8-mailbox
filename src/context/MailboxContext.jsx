// src/context/MailboxContext.jsx
import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react'
import {
  fetchMessages, fetchThread, markRead,
  moveToFolder, toggleStar, fetchUnreadCounts, supabase, FOLDER,
} from '../services/supabase'

// FIX #9: cursor is now { timestamp, id } object instead of plain timestamp string
function normalizeMessage(row) {
  const msg    = row.messages || {}
  const sender = msg.profiles || {}
  const ts     = row.created_at || msg.created_at || null
  return {
    id:              msg.id,
    recipientRowId:  row.id,
    folder:          row.folder,
    is_read:         row.is_read      ?? false,
    is_starred:      row.is_starred   ?? false,
    delivery_status: row.delivery_status,
    messageId:       msg.id,
    threadId:        msg.thread_id,
    subject:         msg.subject      || '(no subject)',
    body:            msg.body         || '',
    preview:         (msg.body || '').replace(/<[^>]+>/g, '').slice(0, 120),
    isPriority:      msg.is_priority  ?? false,
    is_deleted:      msg.is_deleted   ?? false,
    created_at:      ts,
    timestamp:       ts,
    senderId:        msg.sender_id,
    senderName:      sender.name      || sender.email || 'Unknown',
    senderEmail:     sender.email     || '',
    senderInitials:  sender.initials  || (sender.name || 'U').slice(0, 2).toUpperCase(),
    senderRole:      sender.role      || '',
    attachments:     msg.attachments  || [],
  }
}

const initialState = {
  messages:       [],
  selectedId:     null,
  selectedThread: [],
  activeFolder:   FOLDER.INBOX,
  unreadCounts:   {},
  isLoading:      false,
  hasMore:        true,
  cursor:         null,   // FIX #9: { timestamp, id } | null
  error:          null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOADING':
      return { ...state, isLoading: true, error: null }

    case 'MESSAGES_LOADED': {
      const normalized = action.payload.map(normalizeMessage)
      const last = normalized[normalized.length - 1]
      return {
        ...state,
        isLoading: false,
        messages:  action.append ? dedupeById([...state.messages, ...normalized]) : normalized,
        // FIX #9: composite cursor
        cursor:    last ? { timestamp: last.created_at, id: last.recipientRowId } : null,
        hasMore:   action.hasMore,
      }
    }

    case 'PREPEND_MESSAGE': {
      const normalized = action.payload.senderName !== undefined
        ? action.payload
        : normalizeMessage(action.payload)
      if (action.folder && normalized.folder && normalized.folder !== action.folder) return state
      return { ...state, messages: dedupeById([normalized, ...state.messages]) }
    }

    case 'UPDATE_MESSAGE': {
      const idx = state.messages.findIndex(m => m.id === action.id)
      if (idx === -1) return state
      const updated = [...state.messages]
      updated[idx] = { ...updated[idx], ...action.patch }
      return { ...state, messages: updated }
    }

    case 'REMOVE_MESSAGE':
      return {
        ...state,
        messages:   state.messages.filter(m => m.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      }

    case 'SELECT_MESSAGE':
      return { ...state, selectedId: action.id }

    case 'THREAD_LOADED':
      return { ...state, selectedThread: action.payload }

    case 'SET_FOLDER':
      return {
        ...state,
        activeFolder:   action.folder,
        selectedId:     null,
        selectedThread: [],
        messages:       [],
        cursor:         null,
        hasMore:        true,
      }

    case 'UNREAD_COUNTS':
      return { ...state, unreadCounts: action.payload }

    case 'ERROR':
      return { ...state, isLoading: false, error: action.error }

    default:
      return state
  }
}

function dedupeById(arr) {
  const seen = new Set()
  return arr.filter(item => {
    if (!item?.id || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

const MailboxContext = createContext(null)

export function MailboxProvider({ children, currentUser }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const inflightRef = useRef(new Set())

  const loadMessages = useCallback(async (folder, append = false) => {
    if (!currentUser?.id) return
    const key = `${folder}-${append ? (state.cursor?.timestamp || 'end') : 'fresh'}`
    if (inflightRef.current.has(key)) return
    inflightRef.current.add(key)
    dispatch({ type: 'LOADING' })
    try {
      const data = await fetchMessages({
        folder,
        userId:   currentUser.id,
        userRole: currentUser.role || null,
        cursor:   append ? state.cursor : null,
        limit:    30,
      })
      dispatch({
        type:    'MESSAGES_LOADED',
        payload: data,
        append,
        hasMore: data.length === 30,
      })
    } catch (err) {
      dispatch({ type: 'ERROR', error: err.message })
    } finally {
      inflightRef.current.delete(key)
    }
  }, [state.cursor, currentUser?.id])

  const refreshUnreadCounts = useCallback(async () => {
    if (!currentUser?.id) return
    try {
      const counts = await fetchUnreadCounts(currentUser.id, currentUser.role || null)
      dispatch({ type: 'UNREAD_COUNTS', payload: counts })
    } catch (_) {}
  }, [currentUser?.id])

  const selectMessage = useCallback(async (id) => {
    dispatch({ type: 'SELECT_MESSAGE', id })
    dispatch({ type: 'THREAD_LOADED', payload: [] })

    const msg = state.messages.find(m => m.id === id)
    if (!msg) return

    fetchThread(msg.threadId)
      .then(msgs => dispatch({ type: 'THREAD_LOADED', payload: msgs || [] }))
      .catch(err => console.error('fetchThread failed:', err))

    if (!msg.is_read && msg.recipientRowId) {
      dispatch({ type: 'UPDATE_MESSAGE', id, patch: { is_read: true } })
      try {
        await markRead(msg.recipientRowId, true)
        refreshUnreadCounts()
      } catch (err) {
        console.error('markRead failed:', err)
        dispatch({ type: 'UPDATE_MESSAGE', id, patch: { is_read: false } })
      }
    }
  }, [state.messages, refreshUnreadCounts])

  const markMessageRead = useCallback(async (id, isRead) => {
    const msg = state.messages.find(m => m.id === id)
    if (!msg?.recipientRowId) return
    dispatch({ type: 'UPDATE_MESSAGE', id, patch: { is_read: isRead } })
    try {
      await markRead(msg.recipientRowId, isRead)
      refreshUnreadCounts()
    } catch (err) {
      console.error('markMessageRead failed:', err)
      dispatch({ type: 'UPDATE_MESSAGE', id, patch: { is_read: !isRead } })
    }
  }, [state.messages, refreshUnreadCounts])

  const starMessage = useCallback(async (id) => {
    const msg = state.messages.find(m => m.id === id)
    if (!msg?.recipientRowId) return
    const next = !msg.is_starred
    dispatch({ type: 'UPDATE_MESSAGE', id, patch: { is_starred: next } })
    try {
      await toggleStar(msg.recipientRowId, next)
    } catch {
      dispatch({ type: 'UPDATE_MESSAGE', id, patch: { is_starred: !next } })
    }
  }, [state.messages])

  const moveMessage = useCallback(async (id, targetFolder) => {
    const msg = state.messages.find(m => m.id === id)
    if (!msg) return null

    let recipientRowId = msg.recipientRowId

    if (!recipientRowId && currentUser?.id) {
      try {
        const { data } = await supabase
          .from('message_recipients')
          .select('id')
          .eq('message_id', id)
          .eq('recipient_id', currentUser.id)
          .maybeSingle()
        recipientRowId = data?.id || null
        if (recipientRowId) {
          dispatch({ type: 'UPDATE_MESSAGE', id, patch: { recipientRowId } })
        }
      } catch (e) {
        console.warn('Could not resolve recipientRowId:', e)
      }
    }

    if (!recipientRowId) {
      console.error('moveMessage: recipientRowId is null', { id, targetFolder })
      return null
    }

    const prevFolder = msg.folder
    dispatch({ type: 'REMOVE_MESSAGE', id })

    try {
      await moveToFolder(recipientRowId, targetFolder, id)
      refreshUnreadCounts()
      if (targetFolder === 'deleted') return null
      return { undo: () => revertMove(id, prevFolder, { ...msg, recipientRowId }) }
    } catch (err) {
      console.error('moveMessage failed:', err)
      dispatch({ type: 'PREPEND_MESSAGE', payload: { ...msg, folder: prevFolder } })
      return null
    }
  }, [state.messages, refreshUnreadCounts, currentUser?.id])

  const revertMove = useCallback(async (id, prevFolder, msgSnapshot) => {
    dispatch({ type: 'PREPEND_MESSAGE', payload: { ...msgSnapshot, folder: prevFolder } })
    await moveToFolder(msgSnapshot.recipientRowId, prevFolder, id)
    refreshUnreadCounts()
  }, [refreshUnreadCounts])

  const selectedIdRef = useRef(state.selectedId)
  const messagesRef   = useRef(state.messages)
  useEffect(() => { selectedIdRef.current = state.selectedId }, [state.selectedId])
  useEffect(() => { messagesRef.current   = state.messages   }, [state.messages])

  const ingestRealtimeMessage = useCallback((msg, targetFolder = FOLDER.INBOX) => {
    dispatch({ type: 'PREPEND_MESSAGE', payload: msg, folder: targetFolder })
    refreshUnreadCounts()
    const threadId = msg?.thread_id || msg?.threadId
    if (threadId) {
      const selected = messagesRef.current.find(m => m.id === selectedIdRef.current)
      if (selected?.threadId === threadId) {
        fetchThread(threadId)
          .then(msgs => dispatch({ type: 'THREAD_LOADED', payload: msgs || [] }))
          .catch(console.error)
      }
    }
  }, [refreshUnreadCounts])

  const refreshThread = useCallback(async (threadId) => {
    if (!threadId) return
    try {
      const msgs = await fetchThread(threadId)
      dispatch({ type: 'THREAD_LOADED', payload: msgs || [] })
    } catch (err) {
      console.error('refreshThread failed:', err)
    }
  }, [])

  const setFolder = useCallback((folder) => {
    dispatch({ type: 'SET_FOLDER', folder })
  }, [])

  useEffect(() => {
    if (currentUser?.id) loadMessages(state.activeFolder)
  }, [state.activeFolder, currentUser?.id])

  useEffect(() => { refreshUnreadCounts() }, [currentUser?.id])

  const selectedMessage = state.messages.find(m => m.id === state.selectedId) || null

  return (
    <MailboxContext.Provider value={{
      ...state,
      selectedMessage,
      loadMessages,
      loadMore:             () => loadMessages(state.activeFolder, true),
      selectMessage,
      markMessageRead,
      starMessage,
      moveMessage,
      setFolder,
      ingestRealtimeMessage,
      refreshUnreadCounts,
      refreshThread,
    }}>
      {children}
    </MailboxContext.Provider>
  )
}

export function useMailbox() {
  const ctx = useContext(MailboxContext)
  if (!ctx) throw new Error('useMailbox must be used within MailboxProvider')
  return ctx
}
