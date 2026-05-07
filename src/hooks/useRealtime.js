// src/hooks/useRealtime.js
import { useEffect, useRef, useCallback } from 'react'
import { supabase, fetchMessageById } from '../services/supabase'
import { createLruSet } from '../utils/lruSet'

const RECONNECT_DELAY_MS      = 3000
const MAX_RECONNECT_ATTEMPTS  = 5
const POLLING_INTERVAL_MS     = parseInt(import.meta.env.VITE_POLLING_INTERVAL_MS || '30000', 10)

// FIX #8: onResync is a separate callback — polling never sends null to onNewMessage
export function useRealtime({ userId, userRole = null, onNewMessage, onReadUpdate, onStatusChange, onResync }) {
  const channelRef          = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  // FIX #10: LRU set — O(1) has/add, bounded size, evicts oldest entries fairly
  const seenEventIds        = useRef(createLruSet(300))
  const pollingRef          = useRef(null)
  const mountedRef          = useRef(true)

  const handleEvent = useCallback((event, payload) => {
    const eventKey = `${event}-${payload?.new?.id}-${payload?.commit_timestamp}`
    if (seenEventIds.current.has(eventKey)) return
    seenEventIds.current.add(eventKey)

    switch (event) {
      case 'INSERT':
        if (payload.table === 'message_recipients' && onNewMessage) {
          const messageId = payload.new?.message_id
          if (!messageId) break
          fetchMessageById(messageId, userId, userRole)
            .then(msg => {
              if (!mountedRef.current || !onNewMessage || !msg) return
              if (msg.sender_id === userId) return  // skip self-notification
              onNewMessage(msg, msg._recipientRow)
            })
            .catch(err => console.warn('Realtime message fetch failed:', err))
        }
        break
      case 'UPDATE':
        if (payload.table === 'message_recipients' && onReadUpdate) {
          onReadUpdate(payload.new)
        }
        break
      default:
        break
    }
  }, [userId, onNewMessage, onReadUpdate])

  // FIX #8: polling calls onResync — no null message passed to onNewMessage
  const startPolling = useCallback(() => {
    if (pollingRef.current) return
    pollingRef.current = setInterval(() => {
      if (mountedRef.current && onResync) onResync()
    }, POLLING_INTERVAL_MS)
  }, [onResync])

  const subscribe = useCallback(() => {
    if (!userId) return

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    let channel = supabase
      .channel(`mailbox:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'message_recipients',
        filter: `recipient_id=eq.${userId}`,
      }, payload => handleEvent('INSERT', payload))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'message_recipients',
        filter: `recipient_id=eq.${userId}`,
      }, payload => handleEvent('UPDATE', payload))

    // Subscribe to role-broadcast inserts so notifications fire for role recipients
    if (userRole) {
      channel = channel.on('postgres_changes', {
        event: 'INSERT', schema: 'public',
        table: 'message_recipients',
        filter: `recipient_role=eq.${userRole}`,
      }, payload => handleEvent('INSERT', payload))
    }

    channel = channel.subscribe(status => {
        if (!mountedRef.current) return
        if (onStatusChange) onStatusChange(status)

        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const attempts = reconnectAttemptsRef.current
          if (attempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_DELAY_MS * Math.pow(2, attempts)
            reconnectAttemptsRef.current += 1
            setTimeout(() => { if (mountedRef.current) subscribe() }, delay)
          } else {
            startPolling()
          }
        }
      })

    channelRef.current = channel
  }, [userId, userRole, handleEvent, onStatusChange, startPolling])

  useEffect(() => {
    mountedRef.current = true
    subscribe()
    return () => {
      mountedRef.current = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [subscribe])
}

// Re-sync after browser tab becomes visible again
export function useVisibilitySync(onVisible) {
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') onVisible() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [onVisible])
}
