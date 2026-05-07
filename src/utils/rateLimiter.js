// src/utils/rateLimiter.js
export function createRateLimiter(limit, windowMs = 60_000) {
  const timestamps = []

  return {
    canProceed() {
      const now = Date.now()
      while (timestamps.length && timestamps[0] < now - windowMs) {
        timestamps.shift()
      }
      if (timestamps.length >= limit) return false
      timestamps.push(now)
      return true
    },
    remaining() {
      const now = Date.now()
      const recent = timestamps.filter(t => t >= now - windowMs)
      return Math.max(0, limit - recent.length)
    },
  }
}
