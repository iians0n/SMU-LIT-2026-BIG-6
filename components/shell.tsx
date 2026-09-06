'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FileSearch,
  LayoutGrid,
  Route,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useCase } from '@/components/case-provider';

const primary = [
  ['/', 'Tell your story'],
  ['/documents', 'Add documents'],
  ['/chronology', 'Review details'],
  ['/prepare', 'Download PDF'],
] as const;

const more = [
  ['/evidence', 'Evidence details', FileSearch],
  ['/route', 'Filing check', Route],
  ['/options', 'Choose next step', ClipboardCheck],
  ['/dashboard', 'Case overview', LayoutGrid],
  ['/sources', 'Help and sources', BookOpen],
  ['/verification', 'Activity history', ClipboardCheck],
] as const;

function CasepathMark() {
  return (
    <svg viewBox="0 0 40 40" role="img" aria-label="Casepath">
      <path d="M29 7H17.5A11.5 11.5 0 0 0 6 18.5v3A11.5 11.5 0 0 0 17.5 33H27" className="brand-c" />
      <circle cx="13" cy="20" r="2.5" className="brand-dot" />
      <path d="M15.5 20h6.2l3.6 3.7" className="brand-route" />
      <path d="m24.7 23.5 2.9 2.9 6.2-7.3" className="brand-check" />
    </svg>
  );
}

function activeStage(path: string): number | null {
  if (path === '/') return 0;
  if (path === '/documents' || path === '/evidence') return 1;
  if (['/chronology', '/route', '/options', '/dashboard', '/verification'].includes(path)) return 2;
  if (path === '/prepare') return 3;
  return null;
}

function Journey() {
  const path = usePathname();
  const { record, workflow } = useCase();
  const current = activeStage(path);

  const complete = (href: string): boolean => {
    if (!record || !workflow) return false;
    if (href === '/') return record.facts.length > 0 || record.parties.length > 0;
    if (href === '/documents') {
      return record.documents.length > 0 && record.documents.every((document) => document.processingStatus !== 'processing');
    }
    if (href === '/chronology') {
      return record.facts.length > 0 && record.facts.every((fact) => fact.confirmedByUser || fact.unknown) && !record.facts.some((fact) => fact.disputed);
    }
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
    <nav className="journey" aria-label="Case preparation steps">
      {primary.map(([href, label], index) => {
        const isComplete = complete(href);
        const isCurrent = current === index;
        return (
          <Link
            key={href}
            href={href}
            className="journey-link"
            aria-current={isCurrent ? 'step' : undefined}
            data-complete={isComplete || undefined}
          >
            <span className="journey-number" aria-hidden="true">
              {isComplete && !isCurrent ? <Check size={17} strokeWidth={2.6} /> : index + 1}
            </span>
            <span className="journey-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function MoreMenu() {
  const path = usePathname();
  const { record, workflow } = useCase();
  const menu = useRef<HTMLDetailsElement>(null);
  const onAdvancedPage = more.some(([href]) => href === path);

  const complete = (href: string): boolean => {
    if (!record || !workflow) return false;
    if (href === '/evidence') {
      return record.documents.length > 0 && record.issues.length > 0 && record.issues.every((issue) => issue.sourceCaseVersion === record.version);
    }
    if (href === '/route') {
      return workflow.route.sourceCaseVersion === record.version && workflow.route.reviewed;
    }
    if (href === '/options') return workflow.option !== null;
    return false;
  };

  useEffect(() => {
    menu.current?.removeAttribute('open');
  }, [path]);

  return (
    <details ref={menu} className="tools-menu" data-active={onAdvancedPage || undefined}>
      <summary>
        <span>More</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <nav className="tools-menu-panel" aria-label="More tools">
        {more.map(([href, label, Icon]) => {
          const isComplete = complete(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={path === href ? 'page' : undefined}
              data-complete={isComplete || undefined}
              onClick={() => menu.current?.removeAttribute('open')}
            >
              {isComplete ? <Check size={18} strokeWidth={2.6} aria-hidden="true" /> : <Icon size={18} aria-hidden="true" />}
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </details>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>

      <header className="site-header">
        <div className="site-header-inner">
          <Link href="/" className="brand" aria-label="Casepath home">
            <span className="brand-mark"><CasepathMark /></span>
            <span>Casepath</span>
          </Link>
          <div className="header-actions">
            <Link className="header-link" href="/sources">
              <CircleHelp size={19} aria-hidden="true" />
              <span>Help</span>
            </Link>
            <span className="header-divider" aria-hidden="true" />
            <MoreMenu />
          </div>
        </div>
      </header>

      <div className="journey-bar">
        <div className="journey-inner"><Journey /></div>
      </div>

      <main className="main-frame" id="main-content">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
