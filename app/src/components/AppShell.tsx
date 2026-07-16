/**
 * App shell per DESIGN.md §Layout:
 *  - ≥1024px: fixed left sidebar 220px
 *  - 768–1023px: icon rail 64px
 *  - <768px: bottom nav bar with safe-area padding
 */

import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import BudgetBanner from './BudgetBanner';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const iconProps = {
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    to: '/sweeps',
    label: 'Sweeps',
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
  {
    to: '/leads',
    label: 'Leads',
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    to: '/pipeline',
    label: 'Pipeline',
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <path d="M6 3v18" />
        <path d="M12 3v10" />
        <path d="M18 3v14" />
        <circle cx="6" cy="21" r="0.5" />
        <circle cx="12" cy="16" r="0.5" />
        <circle cx="18" cy="20" r="0.5" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" {...iconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

function navLinkClass(isActive: boolean): string {
  return [
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-surface-2 text-accent' : 'text-text-dim hover:bg-surface-2 hover:text-text',
  ].join(' ');
}

export default function AppShell() {
  const { signOutUser, user } = useAuth();

  return (
    <div className="min-h-dvh">
      {/* Sidebar ≥1024px / icon rail 768–1023px */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-16 flex-col border-r border-border bg-surface md:flex lg:w-[220px]">
        <div className="flex h-14 items-center justify-center border-b border-border px-3 lg:justify-start">
          <span className="font-mono text-sm font-semibold text-accent">
            <span className="lg:hidden">F</span>
            <span className="hidden lg:inline">FlowDev · WMS</span>
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} title={item.label}>
              {({ isActive }) => (
                <span className={navLinkClass(isActive) + ' justify-center lg:justify-start'}>
                  {item.icon}
                  <span className="hidden lg:inline">{item.label}</span>
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <button
            onClick={() => void signOutUser()}
            title={`Sign out ${user?.email ?? ''}`}
            className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm text-text-dim transition-colors hover:bg-surface-2 hover:text-text lg:justify-start"
          >
            <svg viewBox="0 0 24 24" {...iconProps}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="pb-20 md:ml-16 md:pb-0 lg:ml-[220px]">
        <BudgetBanner />
        <Outlet />
      </main>

      {/* Bottom nav <768px */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="flex-1"
            title={item.label}
          >
            {({ isActive }) => (
              <span
                className={[
                  'flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-text-dim',
                ].join(' ')}
              >
                {item.icon}
                {item.label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
