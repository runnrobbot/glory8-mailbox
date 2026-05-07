import { memo } from 'react'

const PALETTE = [
  '#D4AF37','#2563EB','#059669','#DC2626','#7C3AED',
  '#0891B2','#D97706','#BE185D','#065F46','#1D4ED8',
]
function colorFromName(name) {
  if (!name) return '#888'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function isLight(hex) {
  if (!hex || typeof hex !== 'string') return false
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16)
  return (r*299+g*587+b*114)/1000 > 155
}

export const AvatarInitials = memo(function AvatarInitials({ name, color, initials, size = 32 }) {
  const computed = initials || (name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const bg = color || colorFromName(name)
  return (
    <div
      aria-hidden="true"
      style={{
        width: size, height: size, borderRadius: '50%',
        background: bg, color: isLight(bg) ? '#111' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 700, flexShrink: 0,
        fontFamily: 'Inter, sans-serif', userSelect: 'none',
      }}
    >
      {computed}
    </div>
  )
})
