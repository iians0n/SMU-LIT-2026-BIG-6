'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Check,
  ChevronDown,
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
import { useCase } from '@/components/case-provider';

const primary = [
  ['/', 'Start', MessagesSquare],
  ['/documents', 'Add documents', FolderOpen],
  ['/chronology', 'Review details', UserRound],
  ['/prepare', 'Download PDF', FileArchive],
] as const;

const more = [
  ['/evidence', 'Evidence details', FileSearch],
  ['/route', 'Filing check', Route],
  ['/options', 'Choose next step', ClipboardCheck],
  ['/dashboard', 'Case overview', LayoutGrid],
  ['/sources', 'Help and sources', BookOpen],
  ['/verification', 'Activity history', ClipboardCheck],
] as const;

function Navigation({ close }: { close?: () => void }) {
  const path = usePathname();
  const { record, workflow } = useCase();
  const complete = (href: string): boolean => {
    if (!record || !workflow) return false;
    if (href === '/') return record.facts.length > 0 || record.parties.length > 0;
    if (href === '/documents') {
      return record.documents.length > 0 && record.documents.every((document) => document.processingStatus !== 'processing');
    }
    if (href === '/chronology') {
      return record.facts.length > 0 && record.facts.every((fact) => fact.confirmedByUser || fact.unknown) && !record.facts.some((fact) => fact.disputed);
    }
    if (href === '/evidence') {
      return record.documents.length > 0 && record.issues.length > 0 && record.issues.every((issue) => issue.sourceCaseVersion === record.version);
    }
    if (href === '/route') {
      return workflow.route.sourceCaseVersion === record.version && workflow.route.reviewed;
    }
    if (href === '/options') return workflow.option !== null;
    if (href === '/prepare') {
      const populated = workflow.draft.fields.filter((field) => field.value);
      return workflow.draft.sourceCaseVersion === record.version &&
        workflow.draft.contradictionsAvailable &&
        populated.every((field) => field.reviewedAt && field.sourceCaseVersion === record.version) &&
        workflow.draft.gapsAcknowledged &&
        !workflow.draft.warnings.some((warning) => warning.includes('differs from'));
    }
    return false;
  };

  return (
    <>
      <div className="side-heading">Your checklist</div>
      <nav className="side-nav" aria-label="Preparation stages">
        {primary.map(([href, label, Icon]) => {
          const isComplete = complete(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={close}
              className="side-link"
              aria-current={path === href ? 'page' : undefined}
              data-complete={isComplete || undefined}
            >
              <span className="side-icon" aria-hidden="true">
                {isComplete ? <Check size={15} strokeWidth={2.5} /> : <Icon size={18} />}
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <details className="side-more" open={more.some(([href]) => href === path) || undefined}>
        <summary>
          <span>More tools</span>
          <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <nav className="side-nav" aria-label="More tools">
          {more.map(([href, label, Icon]) => (
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
      </details>

      <div className="side-spacer" />

      <div className="privacy-note">
        <ShieldCheck size={17} aria-hidden="true" />
        <span>Nothing is filed automatically.<br /><small>You choose what to download or send.</small></span>
      </div>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [mobile, setMobile] = useState(false);
  const menuClose = useRef<HTMLButtonElement>(null);
  const current = [...primary, ...more].find(([href]) => href === path);

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
            <div className="topbar-title">{current?.[1] ?? 'Casepath'}</div>
          </div>
          <div className="topbar-actions">
            <Link className="button button-quiet" href="/sources">
              <CircleHelp size={18} aria-hidden="true" /><span>Help</span>
            </Link>

          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
