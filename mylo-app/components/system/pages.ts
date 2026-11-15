/* /settings/[page]: which subpage each slug opens. */
export const SETTINGS_PAGES = {
  privacy: 'Privacy and safety', blocked: 'Blocked people', muted: 'Muted people', words: 'Hidden words',
  language: 'Language', help: 'Help and feedback', about: 'About', licences: 'Open source licences',
  notifications: 'Notifications', data: 'Your data', email: 'Change email', phone: 'Phone number', password: 'Change password',
  delete: 'Delete account', 'delete-confirm': 'Delete account', deleted: 'Account deleted', logout: 'Settings'
} as const;
export type SettingsSlug = keyof typeof SETTINGS_PAGES;
