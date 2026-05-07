// src/utils/lruSet.js
export function createLruSet(maxSize) {
  const map = new Map()

  return {
    has(key) {
      return map.has(key)
    },
    add(key) {
      if (map.has(key)) return
      if (map.size >= maxSize) {
        const oldest = map.keys().next().value
        map.delete(oldest)
      }
      map.set(key, true)
    },
    get size() {
      return map.size
    },
  }
}
