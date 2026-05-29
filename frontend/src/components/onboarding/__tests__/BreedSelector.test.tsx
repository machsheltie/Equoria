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
    statTendencies: {
      speed: { min: 75, max: 100, avg: 88 },
      stamina: { min: 60, max: 85, avg: 73 },
      agility: { min: 55, max: 80, avg: 68 },
      balance: { min: 50, max: 75, avg: 63 },
      precision: { min: 45, max: 70, avg: 58 },
      boldness: { min: 70, max: 95, avg: 83 },
    },
    loreBlurb: 'Born to race, bred for glory.',
  },
  {
    id: 2,
    name: 'Arabian',
    description: 'An endurance breed',
    statTendencies: {
      speed: { min: 65, max: 90, avg: 78 },
      stamina: { min: 70, max: 95, avg: 83 },
      agility: { min: 65, max: 90, avg: 78 },
      balance: { min: 60, max: 85, avg: 73 },
      precision: { min: 60, max: 85, avg: 73 },
      boldness: { min: 55, max: 80, avg: 68 },
    },
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

  // Equoria-55bo.4 — Spec 11.3.4 visual enrichments derived from REAL
  // statTendencies (mini-radar + top-3 discipline-strength badges).
  describe('Stat radar + discipline badges (Equoria-55bo.4)', () => {
    it('renders a stat-tendency mini radar per breed card', () => {
      render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
      const radars = screen.getAllByTestId('breed-stat-radar');
      // one radar per breed card in grid view
      expect(radars.length).toBe(mockBreeds.length);
      // radar exposes an accessible label built from the real avg values
      expect(radars[0]).toHaveAttribute('aria-label', expect.stringContaining('Spd 88'));
    });

    it('renders top-3 discipline-strength badges derived from real tendencies', () => {
      render(<BreedSelector breeds={mockBreeds} value={{}} onChange={onChange} />);
      const badgeGroups = screen.getAllByTestId('breed-discipline-badges');
      expect(badgeGroups.length).toBeGreaterThan(0);
      // Thoroughbred (speed 88 / boldness 83) → Racing is a top discipline
      const firstGroup = badgeGroups[0];
      expect(firstGroup.textContent).toMatch(/Racing|Steeplechase|Barrel Racing|Gymkhana/);
      // exactly 3 badges (top-3) — each badge is a direct-child span
      expect(firstGroup.querySelectorAll(':scope > span').length).toBe(3);
    });

    it('shows discipline badges in the selected-breed lore panel', () => {
      render(
        <BreedSelector
          breeds={mockBreeds}
          value={{ breedId: 1, breedName: 'Thoroughbred' }}
          onChange={onChange}
        />
      );
      // grid cards + lore panel each render a badge group
      expect(screen.getAllByTestId('breed-discipline-badges').length).toBeGreaterThan(
        mockBreeds.length
      );
    });
  });
});
