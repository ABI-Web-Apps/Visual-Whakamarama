import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyText } from '../src/utils/clipboard'

function setSecure(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
}
function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

describe('copyText', () => {
  let execCommand: ReturnType<typeof vi.fn>

  beforeEach(() => {
    execCommand = vi.fn(() => true)
    ;(document as unknown as { execCommand: unknown }).execCommand = execCommand
  })
  afterEach(() => {
    setSecure(true)
    setClipboard(undefined)
    document.body.innerHTML = ''
  })

  it('uses the Clipboard API on a secure page', async () => {
    const writeText = vi.fn(async () => {})
    setSecure(true)
    setClipboard({ writeText })
    expect(await copyText('jiali.xu@auckland.ac.nz')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('jiali.xu@auckland.ac.nz')
    expect(execCommand).not.toHaveBeenCalled()
  })

  it('falls back to a hidden textarea on a plain-http page, where the Clipboard API does not exist', async () => {
    setSecure(false)
    setClipboard(undefined)
    let copied = ''
    execCommand.mockImplementation(() => {
      copied = (document.activeElement as HTMLTextAreaElement).value
      return true
    })
    expect(await copyText('a.trevarton@auckland.ac.nz')).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(copied).toBe('a.trevarton@auckland.ac.nz')
    // Nothing is left behind in the page.
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('gives focus back to where it was after the textarea fallback', async () => {
    setSecure(false)
    setClipboard(undefined)
    const button = document.createElement('button')
    document.body.appendChild(button)
    button.focus()
    await copyText('x@y.z')
    expect(document.activeElement).toBe(button)
  })

  it('falls back when the Clipboard API refuses (no permission)', async () => {
    setSecure(true)
    setClipboard({ writeText: vi.fn(async () => { throw new DOMException('denied', 'NotAllowedError') }) })
    expect(await copyText('x@y.z')).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('reports false, and never throws, when nothing can copy', async () => {
    setSecure(false)
    setClipboard(undefined)
    execCommand.mockImplementation(() => { throw new Error('unsupported') })
    expect(await copyText('x@y.z')).toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })
})
