/**
 * BreedSelector Component Tests
 *
 * Tests the breed selection grid/list with gender and name input.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
    // Click Thoroughbred card (there are multiple buttons, get by text)
    const breedButtons = screen.getAllByRole('button', { pressed: false });
    const thoroughbredBtn = breedButtons.find((btn) => btn.textContent?.includes('Thoroughbred'));
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
});
