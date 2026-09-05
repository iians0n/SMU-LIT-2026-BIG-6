'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Check,
  CircleHelp,
  ClipboardCheck,
  FileArchive,
  FileSearch,
  FolderOpen,
  LayoutGrid,
  Menu,
  MessagesSquare,
  Route,
  Scale,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const primary = [
  ['/', 'Talk it through', MessagesSquare, ''],
  ['/documents', 'Your documents', FolderOpen, '1'],
  ['/chronology', 'Check the facts', UserRound, '2'],
  ['/evidence', 'What your files show', FileSearch, '3'],
  ['/options', 'Next steps', Route, '4'],
  ['/prepare', 'Your pack', FileArchive, '5'],
] as const;

const secondary = [
  ['/dashboard', 'Everything at once', LayoutGrid],
  ['/sources', 'Official sources', BookOpen],
  ['/verification', 'Verification record', ClipboardCheck],
] as const;

function Navigation({ close }: { close?: () => void }) {
  const path = usePathname();
  const activeIndex = primary.findIndex(([href]) => href === path);

  return (
    <>
      <div className="side-heading">Your preparation</div>
      <nav className="side-nav" aria-label="Preparation stages">
        {primary.map(([href, label, Icon, step], index) => {
          const complete = activeIndex > index && index > 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              className="side-link"
              aria-current={path === href ? 'page' : undefined}
              data-complete={complete || undefined}
            >
              <span className="side-icon" aria-hidden="true">
                {complete ? <Check size={15} strokeWidth={2.5} /> : <Icon size={18} />}
              </span>
              <span>{label}</span>
              {step && <span className="side-step" aria-hidden="true">{step}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="side-spacer" />
      <div className="side-heading">Reference</div>
      <nav className="side-nav" aria-label="Case references">
        {secondary.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            onClick={close}
            className="side-link side-link-secondary"
            aria-current={path === href ? 'page' : undefined}
          >
            <span className="side-icon" aria-hidden="true"><Icon size={18} /></span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="privacy-note">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>Demo workspace<br /><small>Nothing is filed from here</small></span>
      </div>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  const menuClose = useRef<HTMLButtonElement>(null);
  const current = [...primary, ...secondary].find(([href]) => href === path);

  useEffect(() => {
    if (!mobile) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobile(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => menuClose.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = '';
    };
  }, [mobile]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Casepath home">
          <span className="brand-mark" aria-hidden="true"><Scale size={18} /></span>
          <span>Casepath</span>
        </Link>
        <Navigation />
      </aside>

      {mobile && (
        <>
          <button className="drawer-scrim" tabIndex={-1} aria-hidden="true" onClick={() => setMobile(false)} />
          <aside className="drawer" id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div className="drawer-head">
              <span className="brand drawer-brand">
                <span className="brand-mark" aria-hidden="true"><Scale size={18} /></span>
                <span>Casepath</span>
              </span>
              <button ref={menuClose} className="button button-quiet icon-button" onClick={() => setMobile(false)} aria-label="Close menu">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <Navigation close={() => setMobile(false)} />
          </aside>
        </>
      )}

      <main className="main-frame" id="main-content" inert={mobile ? true : undefined}>
        <header className="topbar">
          <div className="row-start topbar-start">
            <button
              className="button button-quiet icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Open menu"
              aria-expanded={mobile}
              aria-controls="mobile-navigation"
            >
              <Menu size={21} aria-hidden="true" />
            </button>
            <div>
              <div className="topbar-product">Small claims preparation</div>
              <div className="topbar-title">{current?.[1] ?? 'Casepath'}</div>
            </div>
          </div>
          <div className="topbar-actions">
            <Link className="button button-quiet" href="/sources">
              <CircleHelp size={18} aria-hidden="true" /><span>Help</span>
            </Link>
            <div className="status-chip" aria-label="Using a demonstration case">
              <span className="status-dot" aria-hidden="true" />
              <span>Demo case</span>
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
