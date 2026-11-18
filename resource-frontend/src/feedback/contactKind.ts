/**
 * Whether a Stay in touch contact is an email address, a phone number, or
 * neither -- the backend's own rule (app/router/subscribers.py), so the form
 * says "not usable" before sending rather than after:
 *
 * - trimmed; empty or over 254 characters is neither;
 * - an email, lower-cased, fully matching `[^\s@]+@[^\s@.]+(\.[^\s@.]+)+`
 *   (so `a@b`, `a@b.` and `a@.nz` are not);
 * - else a phone, with spaces, brackets, dots and dashes removed, fully
 *   matching `\+?[0-9]{7,15}` (`021 123 4567`, `+64 (21) 123-4567`).
 */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/
const PHONE = /^\+?[0-9]{7,15}$/

export function classifyContact(raw: string): 'email' | 'phone' | null {
  const value = raw.trim()
  if (!value || value.length > 254) return null
  if (EMAIL.test(value.toLowerCase())) return 'email'
  if (PHONE.test(value.replace(/[\s().-]/g, ''))) return 'phone'
  return null
}
