/**
 * GuidePage — the in-game new player guide (Equoria-kd2dd)
 *
 * Owner ruling 2026-10-23: an in-game Guide page in the Celestial look, opened
 * from the one-time welcome note. It renders the single content module
 * `constants/newPlayerGuide.ts` (DRAFT, awaiting the owner's section-by-section
 * review) and holds no rules of its own.
 *
 * Experiential concept: a rider's primer read by lantern light. The title stands
 * alone over the scene; below it one calm reading surface carries the chapters
 * as open type (headings, hairline rules, plain lists and ledger-style tables)
 * rather than a wall of cards, with a chapter index beside it on a wide screen.
 * On a phone the index folds into a single "Chapters" disclosure above the text.
 *
 * Anchors: every chapter is a <section id> and every chapter link is a router
 * link to /guide#<id>. Arriving on a hash (from a link here or a bookmark)
 * scrolls to that chapter and moves focus to its heading so a keyboard or
 * screen-reader player lands in it. Undecided rules show as a quiet "still being
 * decided" note with a deliberately vague topic, never the owner's question.
 *
 * Placement of a navigation link to this page is an open owner question, so the
 * route is reached from the welcome note only. Authored CSS over tokens lives in
 * styles/guide.css; the page background and nav shell come from DashboardLayout.
 */

import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import PageHero from '@/components/layout/PageHero';
import { PageContainer } from '@/components/layout/PageContainer';
import { Surface } from '@/components/ui/Surface';
import {
  guideClosingLine,
  guideTitle,
  newPlayerGuide,
  parseGuideInline,
  type GuideBlock,
  type GuideSection,
} from '@/constants/newPlayerGuide';
import '@/styles/guide.css';

const topId = 'guide-top';
const indexId = 'guide-index';

/* ─── Inline text: bold, italic and links to other chapters ─────────────── */

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseGuideInline(text).map((part, index) => {
        switch (part.kind) {
          case 'bold':
            return <strong key={index}>{part.text}</strong>;
          case 'italic':
            return <em key={index}>{part.text}</em>;
          case 'link':
            return (
              <Link key={index} to={`#${part.sectionId}`} className="guide-link">
                {part.text}
              </Link>
            );
          default:
            return <React.Fragment key={index}>{part.text}</React.Fragment>;
        }
      })}
    </>
  );
}

/* ─── Blocks ─────────────────────────────────────────────────────────────── */

function Block({ block }: { block: GuideBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className="guide-text">
          <Inline text={block.text} />
        </p>
      );
    case 'subheading':
      return <h3 className="guide-subheading">{block.text}</h3>;
    case 'list': {
      const List = block.ordered ? 'ol' : 'ul';
      return (
        <List className={block.ordered ? 'guide-list guide-list--ordered' : 'guide-list'}>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inline text={item} />
            </li>
          ))}
        </List>
      );
    }
    case 'table':
      return (
        // A wide table scrolls on its own so a phone never scrolls the page sideways;
        // tabIndex lets a keyboard player reach it.
        <div className="guide-table" role="region" aria-label={block.caption} tabIndex={0}>
          <table>
            {block.caption && <caption>{block.caption}</caption>}
            <thead>
              <tr>
                {block.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) =>
                    index === 0 ? (
                      <th key={index} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={index}>{cell}</td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'example':
      return (
        <div className="guide-example" role="note">
          <p className="guide-text">
            <Inline text={block.text} />
          </p>
        </div>
      );
    case 'pending':
      // Only the vague topic is shown. The owner's full question stays in the
      // content module for review and is never rendered.
      return (
        <p className="guide-pending" data-guide-pending>
          <span className="guide-pending__label">Still being decided</span>
          <span className="guide-pending__topic">{block.topic}</span>
        </p>
      );
  }
}

/* ─── Chapter ────────────────────────────────────────────────────────────── */

function Chapter({ section }: { section: GuideSection }) {
  const titleId = `${section.id}-title`;
  return (
    <section id={section.id} aria-labelledby={titleId} className="guide-section">
      <header className="guide-section__header">
        <h2 id={titleId} tabIndex={-1} className="type-section-heading guide-section__title">
          {section.title}
        </h2>
        <p className="guide-section__tagline">{section.tagline}</p>
      </header>
      {section.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
      <p className="guide-section__top">
        <Link to={`#${topId}`} className="guide-link">
          Back to the top
        </Link>
      </p>
    </section>
  );
}

/* ─── Chapter index ──────────────────────────────────────────────────────── */

function ChapterList({ onChoose }: { onChoose?: () => void }) {
  return (
    <nav aria-label="Guide sections" className="guide-index__nav">
      <ol className="guide-index__list">
        {newPlayerGuide.map((section) => (
          <li key={section.id}>
            <Link to={`#${section.id}`} className="guide-index__link" onClick={onChoose}>
              {section.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ChapterIndex({ compact }: { compact: boolean }) {
  const [open, setOpen] = useState(false);

  if (!compact) {
    return (
      <div id={indexId} className="guide-index">
        <p className="guide-index__heading">Chapters</p>
        <ChapterList />
      </div>
    );
  }

  return (
    <details
      id={indexId}
      className="guide-index guide-index--compact"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="guide-index__summary">Chapters</summary>
      {/* Choosing a chapter folds the list away so the chapter itself is in view. */}
      <ChapterList onChoose={() => setOpen(false)} />
    </details>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function GuidePage() {
  // `key` changes on every navigation, so choosing the chapter already in the URL still scrolls.
  const { hash, key } = useLocation();
  const isWide = useMediaQuery('(min-width: 1024px)');

  // Land on the chapter named by the URL hash and give its heading focus.
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    const target = document.getElementById(id);
    if (!target) return;
    const heading = id === topId ? target : document.getElementById(`${id}-title`);
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    heading?.focus({ preventScroll: true });
  }, [hash, key]);

  return (
    <div className="guide" data-testid="guide-page">
      <div id={topId} tabIndex={-1} className="guide__top">
        <PageHero title={guideTitle} />
      </div>

      {/* Banner image in glass card */}
      <PageContainer variant="content" padded={false} className="pt-1 pb-4">
        <Surface variant="panel">
          <img
            src="/images/equoriavisitorscenter.jpg"
            alt="The Equoria Visitors Centre"
            className="w-full h-auto rounded-[var(--radius-md)]"
          />
        </Surface>
      </PageContainer>

      <div className="guide__body">
        <aside className="guide__aside">
          <ChapterIndex compact={!isWide} />
        </aside>

        <article className="glass-panel guide__text-surface">
          {newPlayerGuide.map((section) => (
            <Chapter key={section.id} section={section} />
          ))}
          <p className="guide__closing">{guideClosingLine}</p>
        </article>
      </div>
    </div>
  );
}
