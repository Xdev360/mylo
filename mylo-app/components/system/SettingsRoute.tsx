'use client';

import { ChangeContact, ChangePassword } from './AccountForms';
import { DeleteConfirm, Deleted, DeleteWarning } from './DeleteFlow';
import SettingsHome from './SettingsHome';
import { SETTINGS_PAGES, type SettingsSlug } from './pages';
import {
  AboutBody, DataBody, HelpBody, LanguageBody, LicencesBody, NotificationsBody, Page, PeopleBody, PrivacyBody, WordsBody
} from './SettingsPages';

export default function SettingsRoute({ page }: { page: SettingsSlug }) {
  const title = SETTINGS_PAGES[page];
  switch (page) {
    case 'privacy': return <Page title={title}><PrivacyBody /></Page>;
    case 'blocked': return <Page title={title}><PeopleBody list="blocked" /></Page>;
    case 'muted': return <Page title={title}><PeopleBody list="muted" /></Page>;
    case 'words': return <Page title={title}><WordsBody /></Page>;
    case 'language': return <Page title={title}><LanguageBody /></Page>;
    case 'help': return <Page title={title}><HelpBody /></Page>;
    case 'about': return <Page title={title}><AboutBody /><p className="sys-tagline">Made for people who want to show up.</p></Page>;
    case 'licences': return <Page title={title}><LicencesBody /></Page>;
    case 'notifications': return <Page title={title}><NotificationsBody /></Page>;
    case 'data': return <Page title={title} className="sys-data"><DataBody /></Page>;
    case 'email': return <ChangeContact mode="email" />;
    case 'phone': return <ChangeContact mode="phone" />;
    case 'password': return <ChangePassword />;
    case 'delete': return <DeleteWarning />;
    case 'delete-confirm': return <DeleteConfirm />;
    case 'deleted': return <Deleted />;
    case 'logout': return <SettingsHome logout />;
  }
}
