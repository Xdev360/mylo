'use client';

import { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';
import NavMotion from './NavMotion';

import { StoreProvider } from '@/lib/store';
import { SessionProvider } from '@/lib/session';
import CaptureSheet from './CaptureSheet';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import OfflineBanner from './system/OfflineBanner';
import { InstallCapture } from './system/InstallGuide';
import { TickProvider } from './goals/Tick';

/* Every screen sits in here: the sidebar on a wide screen, the tab bar on a
   phone, the capture sheet either can open, the tick moment (C3) every list
   shares, the offline bar (S27) and the browser's install offer (S10, S11). */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <SessionProvider>
    <StoreProvider>
      <TickProvider>
        <NavMotion />
        {/* Marks each route change, so the page moves as one (see globals.css). */}
        <ViewTransition key={path}><span className="vt-tick" aria-hidden /></ViewTransition>
        <OfflineBanner />
        <InstallCapture />
        <div className="app">
          <Sidebar />
          <div className="app-main">{children}</div>
        </div>
        <TabBar />
        <CaptureSheet />
      </TickProvider>
    </StoreProvider>
    </SessionProvider>
  );
}
