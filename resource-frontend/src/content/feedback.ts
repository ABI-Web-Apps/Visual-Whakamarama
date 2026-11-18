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
  /** About and Contact us: the way in from the page itself. */
  open: 'Send feedback',
  openLead: 'Have a thought about this app?',
} as const
