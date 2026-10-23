/**
 * GuidePage (Equoria-kd2dd)
 *
 * The in-game Guide renders the single content module `NEW_PLAYER_GUIDE`:
 * a section index with anchor links, every section with its heading and id,
 * tables as real tables, undecided rules as a quiet "still being decided" note
 * (never the owner's internal question), and #section links that land on and
 * focus the section.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import GuidePage from '../GuidePage';
import { GUIDE_TITLE, NEW_PLAYER_GUIDE } from '../../constants/newPlayerGuide';

function renderGuide(path = '/guide') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/guide" element={<GuidePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GuidePage (Equoria-kd2dd)', () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('has one page title and an index linking to every section', () => {
    renderGuide();

    expect(screen.getByRole('heading', { level: 1, name: GUIDE_TITLE })).toBeInTheDocument();

    const index = screen.getByRole('navigation', { name: 'Guide sections' });
    const links = within(index).getAllByRole('link');
    expect(links).toHaveLength(NEW_PLAYER_GUIDE.length);
    for (const section of NEW_PLAYER_GUIDE) {
      expect(within(index).getByRole('link', { name: section.title })).toHaveAttribute(
        'href',
        `/guide#${section.id}`
      );
    }
  });

  it('renders every section as a labelled region with its heading, tagline and anchor id', () => {
    const { container } = renderGuide();

    for (const section of NEW_PLAYER_GUIDE) {
      const region = container.querySelector(`section#${section.id}`);
      expect(region, `section #${section.id}`).not.toBeNull();
      expect(
        within(region as HTMLElement).getByRole('heading', { level: 2, name: section.title })
      ).toBeInTheDocument();
      expect(within(region as HTMLElement).getByText(section.tagline)).toBeInTheDocument();
    }
  });

  it('lays tables out as real tables with a caption and header cells', () => {
    renderGuide();

    const table = screen.getByRole('table', { name: 'The three stats each discipline counts' });
    expect(within(table).getByRole('columnheader', { name: '50%' })).toBeInTheDocument();
    const hunter = within(table).getByRole('row', { name: /Hunter/ });
    expect(
      within(hunter)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual(['Balance', 'Precision', 'Intelligence']);
  });

  it('turns bold marks and section references into markup, never raw asterisks', () => {
    const { container } = renderGuide();

    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toMatch(/\]\(#/);
    // "(see Competitions)" in Caring for horses is a link to that section.
    const caring = container.querySelector('section#caring-for-horses') as HTMLElement;
    expect(within(caring).getByRole('link', { name: 'Competitions' })).toHaveAttribute(
      'href',
      '/guide#competitions'
    );
  });

  it('shows each undecided rule as a quiet "still being decided" note and never the owner question', () => {
    const { container } = renderGuide();

    const pending = NEW_PLAYER_GUIDE.flatMap((section) => section.blocks).filter(
      (block) => block.kind === 'pending'
    );
    expect(pending.length).toBeGreaterThan(0);

    const notes = container.querySelectorAll('[data-guide-pending]');
    expect(notes).toHaveLength(pending.length);
    // Each note shows exactly its block's topic, in page order.
    const shownTopics = Array.from(notes).map(
      (note) => note.querySelector('.guide-pending__topic')?.textContent
    );
    expect(shownTopics).toEqual(pending.map((block) => block.topic));
    for (const block of pending) {
      expect(container.textContent).not.toContain(block.ownerQuestion);
    }
    expect(container.textContent).not.toContain('PENDING OWNER');
    expect(container.textContent).not.toMatch(/Equoria-[a-z0-9]{5}/);
    for (const note of notes) {
      expect(note.textContent).toMatch(/still being decided/i);
    }
  });

  it('opening /guide#section scrolls to that section and puts focus on its heading', () => {
    renderGuide('/guide#breeding');

    const heading = screen.getByRole('heading', { level: 2, name: 'Breeding' });
    expect(scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(heading);
  });

  it('choosing an index link moves to that section', async () => {
    const user = userEvent.setup();
    renderGuide();

    const index = screen.getByRole('navigation', { name: 'Guide sections' });
    await user.click(within(index).getByRole('link', { name: 'Retirement at 21' }));

    const heading = screen.getByRole('heading', { level: 2, name: 'Retirement at 21' });
    expect(document.activeElement).toBe(heading);
    expect(scrollIntoView).toHaveBeenCalled();
  });
});
