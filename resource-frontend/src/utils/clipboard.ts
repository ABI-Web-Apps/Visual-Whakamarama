/**
 * Copies `text`, and says whether it worked. Never throws.
 *
 * The Clipboard API exists only on a secure page (https, or localhost). The
 * standalone server may be reached over plain http, where `navigator.clipboard`
 * is undefined, so the old way is kept as the fallback: select the text in a
 * throwaway, off-screen textarea and ask the browser to copy the selection.
 * The textarea is removed whatever happens.
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    }
    catch { /* refused (permissions, an unfocused document): try the old way */ }
  }
  return copyWithSelection(text)
}

function copyWithSelection(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  // Off-screen rather than hidden: a hidden element cannot be selected.
  area.style.position = 'fixed'
  area.style.top = '-1000px'
  area.style.opacity = '0'
  document.body.appendChild(area)
  try {
    area.focus()
    area.select()
    area.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  }
  catch {
    return false
  }
  finally {
    area.remove()
  }
}
