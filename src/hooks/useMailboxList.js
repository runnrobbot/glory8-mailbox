// src/hooks/useMailboxList.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useMailbox } from '../context/MailboxContext'

/**
 * Drives the message list panel with:
 * - Local filtering (search, unread, priority, attachments)
 * - Infinite scroll (cursor-based pagination)
 * - Intersection Observer for "load more" trigger
 * - Stable selectedId reference to avoid re-renders
 */
export function useMailboxList() {
  const { messages, isLoading, hasMore, loadMore, activeFolder, selectedId, selectMessage } = useMailbox()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const loadMoreRef = useRef(null)

  // ── Client-side filtering (no server round-trip) ──────────
  const filtered = useMemo(() => {
    let pool = messages
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      pool = pool.filter(m =>
        m.subject?.toLowerCase().includes(q) ||
        m.senderName?.toLowerCase().includes(q) ||
        m.preview?.toLowerCase().includes(q) ||
        m.senderEmail?.toLowerCase().includes(q)
      )
    }
    switch (activeFilter) {
      case 'unread':   return pool.filter(m => !m.is_read)
      case 'priority': return pool.filter(m => m.is_priority)
      case 'attachment': return pool.filter(m => m.attachments?.length > 0)
      default: return pool
    }
  }, [messages, searchQuery, activeFilter])

  const unreadCount = useMemo(() =>
    messages.filter(m => !m.is_read).length,
  [messages])

  // ── Infinite scroll via IntersectionObserver ──────────────
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !hasMore) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isLoading) loadMore()
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, isLoading, loadMore])

  // ── Reset filter on folder change ─────────────────────────
  useEffect(() => {
    setSearchQuery('')
    setActiveFilter('all')
  }, [activeFolder])

  const handleSearch = useCallback(e => setSearchQuery(e.target.value), [])

  return {
    filtered,
    isLoading,
    hasMore,
    unreadCount,
    searchQuery,
    activeFilter,
    selectedId,
    setActiveFilter,
    handleSearch,
    selectMessage,
    loadMoreRef,
  }
}

/**
 * Keyboard navigation within message list
 */
export function useKeyboardNav(messages) {
  const { selectedId, selectMessage } = useMailbox()

  const navigate = useCallback(dir => {
    if (!messages.length) return
    const idx = messages.findIndex(m => m.id === selectedId)
    const next = idx === -1 ? 0 : Math.max(0, Math.min(messages.length - 1, idx + dir))
    if (messages[next]) selectMessage(messages[next].id)
  }, [messages, selectedId, selectMessage])

  return { navigate }
}
