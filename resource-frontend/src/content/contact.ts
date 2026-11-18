/**
 * Contact us: who to write to, and where they are.
 *
 * The two Co-Principal Investigators, as the client gave them. `iwi` is shown
 * beside the name, the way the person introduces themselves. No portrait of
 * Alex exists in `public/team/`, so both people are shown by their initials;
 * give a person a `photo` (a file in `public/team/`) to show their portrait
 * instead -- do it for both, or the two will not match.
 */
export interface ContactPerson {
  name: string
  iwi?: string
  role: string
  email: string
  photo?: string
}

export const CONTACT_PEOPLE: ContactPerson[] = [
  { name: 'Dr Alex Trevarton', iwi: 'Ngāpuhi', role: 'Co-Principal Investigator', email: 'a.trevarton@auckland.ac.nz' },
  { name: 'Dr Jiali Xu', role: 'Co-Principal Investigator', email: 'jiali.xu@auckland.ac.nz' },
]

export const CONTACT_ADDRESS = {
  org: 'Auckland Bioengineering Institute',
  lines: ['Level 7, 70 Symonds Street', 'University of Auckland'],
  mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Auckland Bioengineering Institute, 70 Symonds Street, Auckland')}`,
}

export const CONTACT_COPY = {
  back: 'Back to the resource',
  title: 'Contact us',
  lead: 'Want to know more about Visual Whakamārama? We\'d love to hear from you.',
  peopleLabel: 'The team to contact',
  openMaps: 'Open in Maps',
  /** After the email link: the mail app is opening, and the address was copied as well. */
  opening: 'Opening your email app — the address is copied too.',
  openingNoCopy: (email: string) => `Opening your email app. The address is ${email}.`,
  copied: 'Email address copied.',
  copyFailed: (email: string) => `Copying isn't available here. The address is ${email}.`,
  emailLabel: (name: string, email: string) => `Email ${name} at ${email}`,
  copyLabel: (email: string) => `Copy ${email}`,
  /** When no mail app took the click (none set up, as often on Windows). */
  noApp: 'No email app opened.',
  noAppCopied: 'The address is copied: paste it into your email, or write from the web.',
  noAppNotCopied: (email: string) => `Write to ${email}, or from the web.`,
  outlook: 'Outlook',
  gmail: 'Gmail',
  close: 'Close',
  /** The sidebar's and About's way in. */
  ctaQuestion: 'Questions about this resource?',
  /** The sidebar is 240px wide: the short form keeps the card to two lines. */
  ctaQuestionShort: 'Have a question?',
  ctaAction: 'Contact the team',
} as const

const SUBJECT = 'About Visual Whakamārama'

/** A mail link with the subject filled in, so the reader's message says what it is about. */
export function mailtoHref(email: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(SUBJECT)}`
}

/** A new message in Outlook on the web (the University's own mail), to and subject filled in. */
export function outlookComposeHref(email: string): string {
  return `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(email)}&subject=${encodeURIComponent(SUBJECT)}`
}

/** A new message in Gmail, to and subject filled in. */
export function gmailComposeHref(email: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(SUBJECT)}`
}

/** "Dr Alex Trevarton" -> "AT": the first and last names' initials, titles left out. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(w => w && !/^(dr|prof|professor|mr|mrs|ms|miss|mx)\.?$/i.test(w))
  if (words.length === 0) return ''
  const first = words[0]!.charAt(0)
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : ''
  return (first + last).toUpperCase()
}
