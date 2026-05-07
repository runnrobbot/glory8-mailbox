import DOMPurify from 'dompurify'

const ALLOWED = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote'],
  ALLOWED_ATTR: [],
}

export function sanitizeHtml(dirty) {
  if (typeof dirty !== 'string') return ''
  return DOMPurify.sanitize(dirty, ALLOWED)
}

export function renderBody(raw) {
  const safe = sanitizeHtml(raw)
  return safe.replace(/\n/g, '<br>')
}
