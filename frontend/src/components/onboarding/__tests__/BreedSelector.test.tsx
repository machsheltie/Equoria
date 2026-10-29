/**
 * BreedSelector Component Tests
 *
 * Tests the breed selection grid/list with gender and name input.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BreedSelector } from '../BreedSelector';
import type { Breed } from '@/hooks/api/useBreeds';

const mockBreeds: Breed[] = [
  {
    id: 1,
    name: 'Thoroughbred',
    description: 'A fast breed',
    loreBlurb: 'Born to race, bred for glory.',
  },
  {
    id: 2,
    name: 'Arabian',
    description: 'An endurance breed',
    loreBlurb: 'Sculpted by desert winds.',
  },
];

describe('BreedSelector', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  it('renders with correct data-testid', () => {
    render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
    expect(screen.getByTestId('breed-selector')).toBeInTheDocument();
  });

  it('renders breed cards in grid view', () => {
    render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
    expect(screen.getByText('Thoroughbred')).toBeInTheDocument();
    expect(screen.getByText('Arabian')).toBeInTheDocument();
  });

  it('uses a category-distinct placeholder per body type (Equoria-x83v4)', () => {
    // Sentinel: a draft breed must render the draft silhouette, NOT the bare
    // generic /placeholder.svg. Guards against a revert to the hardcoded src.
    const breedsWithDraft: Breed[] = [
      ...mockBreeds,
      {
        id: 3,
        name: 'Clydesdale',
        description: 'A draft breed',
        loreBlurb: 'A gentle giant.',
      },
    ];
    render(<BreedSelector breeds={breedsWithDraft} value={{}} onChange={onChange} />);

    const clydesdaleImg = screen.getByAltText('Clydesdale') as HTMLImageElement;
    expect(clydesdaleImg.getAttribute('src')).toBe('/images/breeds/category-draft.svg');

    // A light breed (Thoroughbred) still gets the generic placeholder.
    const tbImg = screen.getByAltText('Thoroughbred') as HTMLImageElement;
    expect(tbImg.getAttribute('src')).toBe('/placeholder.svg');
  });

  it('calls onChange when a breed is selected', () => {
    render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
    // Breed cards are ARIA radios inside the radiogroup (Equoria-zanq).
    const breedRadios = screen.getAllByRole('radio');
    const thoroughbredBtn = breedRadios.find((btn) => btn.textContent?.includes('Thoroughbred'));
    fireEvent.click(thoroughbredBtn!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ breedId: 1, breedName: 'Thoroughbred' })
    );
  });

  describe('View toggle', () => {
    it('toggles between grid and list view', () => {
      render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);

      // Default is grid view
      const gridBtn = screen.getByLabelText('Grid view');
      const listBtn = screen.getByLabelText('List view');
      expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
      expect(listBtn).toHaveAttribute('aria-pressed', 'false');

      // Switch to list view
      fireEvent.click(listBtn);
      expect(listBtn).toHaveAttribute('aria-pressed', 'true');
      expect(gridBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('Gender selection', () => {
    it('renders Mare and Stallion buttons', () => {
      render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
      expect(screen.getByText(/Mare/)).toBeInTheDocument();
      expect(screen.getByText(/Stallion/)).toBeInTheDocument();
    });

    it('calls onChange with gender when gender button is clicked', () => {
      render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
      // Find the Mare gender button specifically (not the breed card buttons)
      const genderButtons = screen.getAllByRole('button');
      const mareBtn = genderButtons.find(
        (btn) => btn.textContent?.includes('Mare') && btn.textContent?.includes('\u2640')
      );
      fireEvent.click(mareBtn!);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ gender: 'Mare' }));
    });

    it('shows selected state for current gender', () => {
      render(
        <BreedSelector breeds={mockBreeds} value={{ gender: 'Stallion' }} onChange={onChange} />
      );
      const stallionBtn = screen
        .getAllByRole('button')
        .find(
          (btn) => btn.textContent?.includes('Stallion') && btn.textContent?.includes('\u2642')
        );
      expect(stallionBtn).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Name input', () => {
    it('renders the name input field', () => {
      render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
      expect(screen.getByTestId('horse-name-input')).toBeInTheDocument();
    });

    it('calls onChange when name is typed', async () => {
      const user = userEvent.setup();
      render(<BreedSelector breeds={mockBreeds} value={{ horseName: '' }} onChange={onChange} />);
      const input = screen.getByTestId('horse-name-input');
      await user.type(input, 'M');
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ horseName: 'M' }));
    });

    it('shows preview chip when name has content', () => {
      render(
        <BreedSelector
          breeds={mockBreeds}
          value={{ horseName: 'Midnight', breedName: 'Thoroughbred', gender: 'Mare' }}
          onChange={onChange}
        />
      );
      expect(screen.getByText('Preview:')).toBeInTheDocument();
      // Preview shows name + breed + gender
      expect(screen.getByText(/Midnight/)).toBeInTheDocument();
    });

    it('does not show preview chip when name is empty', () => {
      render(<BreedSelector breeds={mockBreeds} value={{ horseName: '' }} onChange={onChange} />);
      expect(screen.queryByText('Preview:')).not.toBeInTheDocument();
    });

    // Equoria-zalyb (OWNER RULING 2026-09-14): the starter horse's name now
    // meets the shared 40-character rule on the server and is REJECTED rather
    // than silently truncated. The field's job is to make that rejection rare
    // and, when it happens, legible.
    describe('the 40-character rule (Equoria-zalyb)', () => {
      it('stops the field at 40 characters, the same limit the server enforces', () => {
        render(<BreedSelector breeds={mockBreeds} value={{ horseName: '' }} onChange={onChange} />);
        expect(screen.getByTestId('horse-name-input')).toHaveAttribute('maxLength', '40');
      });

      it('shows how much room is left, and reaches zero at the limit', () => {
        const { rerender } = render(
          <BreedSelector breeds={mockBreeds} value={{ horseName: '' }} onChange={onChange} />
        );
        expect(screen.getByTestId('horse-name-counter')).toHaveTextContent(
          '40 of 40 characters left'
        );

        const atLimit = 'M'.repeat(40);
        rerender(
          <BreedSelector breeds={mockBreeds} value={{ horseName: atLimit }} onChange={onChange} />
        );
        expect(screen.getByTestId('horse-name-counter')).toHaveTextContent(
          '0 of 40 characters left'
        );
        // A name AT the limit is accepted, so nothing is announced.
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });

      it('explains a refused character beside the field rather than in a toast', () => {
        render(
          <BreedSelector breeds={mockBreeds} value={{ horseName: 'Fred <3' }} onChange={onChange} />
        );
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('<');
      });

      it('says nothing about an untouched field', () => {
        render(<BreedSelector breeds={mockBreeds} value={{ horseName: '' }} onChange={onChange} />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      });
    });
  });

  it('shows lore blurb when a breed is selected', () => {
    render(
      <BreedSelector
        breeds={mockBreeds}
        value={{ breedId: 1, breedName: 'Thoroughbred' }}
        onChange={onChange}
      />
    );
    expect(screen.getByText(/Born to race, bred for glory/)).toBeInTheDocument();
  });

  // Equoria-4rz4b — text-search filter input over breed list.
  describe('Search input (Equoria-4rz4b)', () => {
    it('renders a search input with the documented testid', () => {
      render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
      const input = screen.getByTestId('breed-search-input');
      expect(input).toBeInTheDocument();
      expect(input.tagName).toBe('INPUT');
    });

    it('does not autofocus the search input on mount', () => {
      render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
      const input = screen.getByTestId('breed-search-input');
      expect(input).not.toHaveFocus();
    });

    it('filters the breed list to case-insensitive name matches after debounce', async () => {
      vi.useFakeTimers();
      try {
        render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
        const input = screen.getByTestId('breed-search-input');
        fireEvent.change(input, { target: { value: 'arab' } });
        // Advance past the 200ms debounce.
        act(() => {
          vi.advanceTimersByTime(250);
        });
        // Arabian (matches) is still rendered; Thoroughbred is filtered out.
        expect(screen.getByText('Arabian')).toBeInTheDocument();
        expect(screen.queryByText('Thoroughbred')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('announces the filtered breed count in an aria-live region', async () => {
      vi.useFakeTimers();
      try {
        render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
        const live = screen.getByTestId('breed-search-live-region');
        // Pre-filter: full count.
        expect(live).toHaveTextContent(`${mockBreeds.length} breeds available`);
        const input = screen.getByTestId('breed-search-input');
        fireEvent.change(input, { target: { value: 'arab' } });
        act(() => {
          vi.advanceTimersByTime(250);
        });
        expect(live).toHaveTextContent(/1 of 2 breeds match "arab"/);
        expect(live).toHaveAttribute('aria-live', 'polite');
      } finally {
        vi.useRealTimers();
      }
    });

    it('restricts arrow-key navigation to the filtered set', async () => {
      vi.useFakeTimers();
      try {
        render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
        const input = screen.getByTestId('breed-search-input');
        fireEvent.change(input, { target: { value: 'arab' } });
        act(() => {
          vi.advanceTimersByTime(250);
        });
        // After filter only Arabian remains. ArrowDown from the lone option
        // wraps back to Arabian itself — never to a filtered-out Thoroughbred.
        const arabianCard = screen
          .getAllByRole('radio')
          .find((el) => el.textContent?.includes('Arabian'));
        expect(arabianCard).toBeTruthy();
        fireEvent.keyDown(arabianCard!, { key: 'ArrowDown' });
        // selectBreed should have been called with Arabian, not Thoroughbred.
        const lastCall = onChange.mock.calls.at(-1)?.[0];
        expect(lastCall).toMatchObject({ breedId: 2, breedName: 'Arabian' });
      } finally {
        vi.useRealTimers();
      }
    });

    it('shows the empty-results panel + clear-search button when nothing matches', async () => {
      vi.useFakeTimers();
      try {
        render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
        const input = screen.getByTestId('breed-search-input');
        fireEvent.change(input, { target: { value: 'no-such-breed-zzz' } });
        act(() => {
          vi.advanceTimersByTime(250);
        });
        expect(screen.getByTestId('breed-search-empty')).toBeInTheDocument();
        // Uses curly quotes (&ldquo;/&rdquo;) per the visible JSX.
        expect(screen.getByText(/No breeds match\s+“no-such-breed-zzz”/)).toBeInTheDocument();
        expect(screen.getByTestId('breed-search-clear-empty')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('restores the full list when the clear-search button is clicked', async () => {
      vi.useFakeTimers();
      try {
        render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
        const input = screen.getByTestId('breed-search-input') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'arab' } });
        act(() => {
          vi.advanceTimersByTime(250);
        });
        expect(screen.queryByText('Thoroughbred')).not.toBeInTheDocument();
        // Inline clear control (X) appears as long as the query is non-empty.
        const clearBtn = screen.getByTestId('breed-search-clear');
        fireEvent.click(clearBtn);
        act(() => {
          vi.advanceTimersByTime(250);
        });
        expect(input.value).toBe('');
        expect(screen.getByText('Thoroughbred')).toBeInTheDocument();
        expect(screen.getByText('Arabian')).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // Owner ruling 2026-10-29 (q292, Equoria-9kakx): the breed picker shows no
  // breed stat bars. Old contract (Equoria-55bo.4, Spec 11.3.4): every card
  // carried stat bars, a stat radar and top-3 discipline-strength badges built
  // from the breed's stat tendencies.
  describe('no breed stat bars (q292)', () => {
    const statText = /\b(Spd|Stm|Agi|Bal|Pre|Bld)\b/;

    it('grid cards show no stat bars, radar or discipline-strength badges', () => {
      render(
        <BreedSelector
          breeds={mockBreeds}
          value={{ breedId: 1, breedName: 'Thoroughbred' }}
          onChange={onChange}
        />
      );
      const selector = screen.getByTestId('breed-selector');
      expect(screen.queryByTestId('breed-stat-radar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('breed-discipline-badges')).not.toBeInTheDocument();
      expect(selector.textContent).not.toMatch(statText);
      // The lore blurb still shows for the selected breed.
      expect(selector.textContent).toContain('Born to race, bred for glory.');
    });

    it('list rows, expanded, show the lore and no stats', async () => {
      const user = userEvent.setup();
      render(
        <BreedSelector
          breeds={mockBreeds}
          value={{ breedId: 1, breedName: 'Thoroughbred' }}
          onChange={onChange}
        />
      );
      await user.click(screen.getByRole('button', { name: /list view/i }));
      await user.click(screen.getByRole('button', { name: /more detail/i }));
      const selector = screen.getByTestId('breed-selector');
      expect(screen.queryByTestId('breed-stat-radar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('breed-discipline-badges')).not.toBeInTheDocument();
      expect(selector.textContent).not.toMatch(statText);
    });
  });
});
