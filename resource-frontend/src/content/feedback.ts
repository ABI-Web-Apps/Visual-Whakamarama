/** The feedback form's words. The questions and notes are the client's own. */
export const FEEDBACK_COPY = {
  launcher: 'Feedback',
  title: 'Quick feedback',
  lead: 'No names. Skip anything you like.',
  easeQuestion: 'How easy was this page to understand?',
  changeQuestion: 'What\'s one thing you\'d change?',
  placeholder: 'Type here, in English or te reo Māori…',
  privacy: 'Please don\'t include personal or health details.',
  charactersLeft: (n: number) => `${n} character${n === 1 ? '' : 's'} left`,
  send: 'Send',
  sending: 'Sending…',
  unreachable: 'The server could not be reached. Check your connection and try again.',
  thanks: 'Thank you — ngā mihi!',
  thanksDetail: 'Your feedback has been sent to the team.',
  talkLead: 'Want to talk to someone?',
  talkAction: 'Contact the team',
  close: 'Close',
  /** The dialog's two halves. */
  tabFeedback: 'Feedback',
  tabStay: 'Stay in touch',
  tabsLabel: 'What would you like to do?',
  /** After sending feedback: the other half. */
  stayLead: 'Want to hear how the project is going?',
  /** About and Contact us: the way in from the page itself. */
  open: 'Send feedback',
  openLead: 'Have a thought about this app?',
} as const

/** Stay in touch: the client's own wording. */
export const KEEP_IN_TOUCH_COPY = {
  title: 'Stay in touch',
  lead: "We'll let you know how the project is going.",
  nameLabel: 'Optional: your first name',
  nameHelp: 'So we know what to call you.',
  namePlaceholder: 'First name',
  contactLabel: 'Your email or mobile number',
  contactPlaceholder: 'e.g. name@email.com or 021 123 4567',
  invalid: 'Enter an email address or a mobile number.',
  send: 'Keep me updated',
  sending: 'Saving…',
  privacy: "We'll only use this to contact you about this project. It is kept separate from your feedback and never shared. You can ask to be removed at any time.",
  done: "You're on the list",
  doneDetail: "We'll be in touch about Visual Whakamārama.",
} as const
