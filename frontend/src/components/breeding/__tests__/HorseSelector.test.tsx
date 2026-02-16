/**
 * Tests for HorseSelector Component
 *
 * Testing Sprint Day 2 - Story 6-1: Breeding Pair Selection
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - canHorseBreed helper function (age, health, cooldown validation)
 * - getStatusColor helper function (badge color logic)
 * - Component rendering states (empty, horses list, search)
 * - Sex filtering (male/female)
 * - Selection state and interactions
 * - Disabled horses display (age, health, cooldown)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HorseSelector from '../HorseSelector';
import type { Horse } from '@/types/breeding';

/**
 * Helper functions replicated for unit testing
 */
function canHorseBreed(horse: Horse): { canBreed: boolean; reason?: string } {
  // Age requirement: 3+ years
  if (horse.age < 3) {
    return { canBreed: false, reason: `Too young (${horse.age}y, needs 3+y)` };
  }

  // Health check
  if (horse.healthStatus && horse.healthStatus.toLowerCase() === 'injured') {
    return { canBreed: false, reason: 'Injured' };
  }

  // Breeding cooldown check
  if (horse.breedingCooldownEndsAt) {
    const cooldownDate = new Date(horse.breedingCooldownEndsAt);
    const now = new Date();

    if (cooldownDate > now) {
      const daysRemaining = Math.ceil(
        (cooldownDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return { canBreed: false, reason: `Cooldown (${daysRemaining}d remaining)` };
    }
  }

  return { canBreed: true };
}

function getStatusColor(canBreed: boolean, reason?: string): string {
  if (canBreed) {
    return 'text-green-700 bg-green-50 border-green-200';
  }

  if (reason?.includes('Cooldown')) {
    return 'text-amber-700 bg-amber-50 border-amber-200';
  }

  return 'text-red-700 bg-red-50 border-red-200';
}

// Test data factory
const createHorse = (overrides: Partial<Horse> = {}): Horse => ({
  id: 1,
  name: 'Test Horse',
  breedName: 'Thoroughbred',
  sex: 'Male',
  age: 5,
  healthStatus: 'healthy',
  ...overrides,
});

describe('canHorseBreed', () => {
  describe('age validation', () => {
    it('should allow breeding for horses 3+ years old', () => {
      const horse = createHorse({ age: 3 });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should allow breeding for horses over 3 years old', () => {
      const horse = createHorse({ age: 10 });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(true);
    });

    it('should prevent breeding for 2-year-old horses', () => {
      const horse = createHorse({ age: 2 });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toBe('Too young (2y, needs 3+y)');
    });

    it('should prevent breeding for 1-year-old horses', () => {
      const horse = createHorse({ age: 1 });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toBe('Too young (1y, needs 3+y)');
    });

    it('should prevent breeding for foals (0 years)', () => {
      const horse = createHorse({ age: 0 });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toBe('Too young (0y, needs 3+y)');
    });
  });

  describe('health validation', () => {
    it('should allow breeding for healthy horses', () => {
      const horse = createHorse({ age: 5, healthStatus: 'healthy' });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(true);
    });

    it('should prevent breeding for injured horses (lowercase)', () => {
      const horse = createHorse({ age: 5, healthStatus: 'injured' });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toBe('Injured');
    });

    it('should prevent breeding for injured horses (mixed case)', () => {
      const horse = createHorse({ age: 5, healthStatus: 'Injured' });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toBe('Injured');
    });

    it('should allow breeding when healthStatus is undefined', () => {
      const horse = createHorse({ age: 5, healthStatus: undefined });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(true);
    });

    it('should allow breeding for horses with other health statuses', () => {
      const horse = createHorse({ age: 5, healthStatus: 'recovering' });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(true);
    });
  });

  describe('cooldown validation', () => {
    it('should allow breeding when no cooldown is set', () => {
      const horse = createHorse({ age: 5, breedingCooldownEndsAt: undefined });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(true);
    });

    it('should prevent breeding when cooldown is active (1 day remaining)', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const horse = createHorse({
        age: 5,
        breedingCooldownEndsAt: tomorrow.toISOString(),
      });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toMatch(/Cooldown \(\d+d remaining\)/);
    });

    it('should prevent breeding when cooldown is active (30 days remaining)', () => {
      const future = new Date();
      future.setDate(future.getDate() + 30);
      const horse = createHorse({
        age: 5,
        breedingCooldownEndsAt: future.toISOString(),
      });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toMatch(/Cooldown \(30d remaining\)/);
    });

    it('should allow breeding when cooldown has expired', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const horse = createHorse({
        age: 5,
        breedingCooldownEndsAt: yesterday.toISOString(),
      });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe('multiple constraints', () => {
    it('should return first failing constraint (age)', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const horse = createHorse({
        age: 2,
        healthStatus: 'injured',
        breedingCooldownEndsAt: tomorrow.toISOString(),
      });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toMatch(/Too young/);
    });

    it('should return first failing constraint (health) when age is valid', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const horse = createHorse({
        age: 5,
        healthStatus: 'injured',
        breedingCooldownEndsAt: tomorrow.toISOString(),
      });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toBe('Injured');
    });

    it('should return cooldown when age and health are valid', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const horse = createHorse({
        age: 5,
        healthStatus: 'healthy',
        breedingCooldownEndsAt: tomorrow.toISOString(),
      });
      const result = canHorseBreed(horse);
      expect(result.canBreed).toBe(false);
      expect(result.reason).toMatch(/Cooldown/);
    });
  });

  describe('return value structure', () => {
    it('should return object with canBreed property', () => {
      const horse = createHorse({ age: 5 });
      const result = canHorseBreed(horse);
      expect(result).toHaveProperty('canBreed');
      expect(typeof result.canBreed).toBe('boolean');
    });

    it('should include reason when cannot breed', () => {
      const horse = createHorse({ age: 2 });
      const result = canHorseBreed(horse);
      expect(result).toHaveProperty('reason');
      expect(typeof result.reason).toBe('string');
    });

    it('should not include reason when can breed', () => {
      const horse = createHorse({ age: 5 });
      const result = canHorseBreed(horse);
      expect(result.reason).toBeUndefined();
    });
  });
});

describe('getStatusColor', () => {
  it('should return green classes when can breed', () => {
    const color = getStatusColor(true);
    expect(color).toBe('text-green-700 bg-green-50 border-green-200');
  });

  it('should return amber classes for cooldown reason', () => {
    const color = getStatusColor(false, 'Cooldown (5d remaining)');
    expect(color).toBe('text-amber-700 bg-amber-50 border-amber-200');
  });

  it('should return amber classes for any cooldown message', () => {
    const color = getStatusColor(false, 'Cooldown (1d remaining)');
    expect(color).toBe('text-amber-700 bg-amber-50 border-amber-200');
  });

  it('should return red classes for age reason', () => {
    const color = getStatusColor(false, 'Too young (2y, needs 3+y)');
    expect(color).toBe('text-red-700 bg-red-50 border-red-200');
  });

  it('should return red classes for injury reason', () => {
    const color = getStatusColor(false, 'Injured');
    expect(color).toBe('text-red-700 bg-red-50 border-red-200');
  });

  it('should return red classes when no reason provided', () => {
    const color = getStatusColor(false);
    expect(color).toBe('text-red-700 bg-red-50 border-red-200');
  });

  it('should return properly formatted Tailwind classes', () => {
    const greenColor = getStatusColor(true);
    expect(greenColor).toMatch(/^text-\w+-\d{3} bg-\w+-\d{2} border-\w+-\d{3}$/);

    const amberColor = getStatusColor(false, 'Cooldown (5d remaining)');
    expect(amberColor).toMatch(/^text-\w+-\d{3} bg-\w+-\d{2} border-\w+-\d{3}$/);

    const redColor = getStatusColor(false, 'Injured');
    expect(redColor).toMatch(/^text-\w+-\d{3} bg-\w+-\d{2} border-\w+-\d{3}$/);
  });
});

describe('HorseSelector Component', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  const stallion1 = createHorse({
    id: 1,
    name: 'Thunder',
    breedName: 'Thoroughbred',
    sex: 'Male',
    age: 5,
  });

  const stallion2 = createHorse({
    id: 2,
    name: 'Lightning',
    breedName: 'Arabian',
    sex: 'Male',
    age: 4,
  });

  const mare1 = createHorse({
    id: 3,
    name: 'Starlight',
    breedName: 'Quarter Horse',
    sex: 'Female',
    age: 6,
  });

  const youngStallion = createHorse({
    id: 4,
    name: 'Junior',
    breedName: 'Thoroughbred',
    sex: 'Male',
    age: 2,
  });

  describe('rendering', () => {
    it('should render component with title', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByText('Select Sire')).toBeInTheDocument();
    });

    it('should render search box with placeholder', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByPlaceholderText('Search by name or breed...')).toBeInTheDocument();
    });

    it('should show stallion subtitle when filter is male', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByText('Select a stallion (3+ years)')).toBeInTheDocument();
    });

    it('should show mare subtitle when filter is female', () => {
      render(
        <HorseSelector
          horses={[mare1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="female"
          title="Select Dam"
        />
      );
      expect(screen.getByText('Select a mare (3+ years)')).toBeInTheDocument();
    });
  });

  describe('sex filtering', () => {
    it('should only show male horses when filter is male', () => {
      render(
        <HorseSelector
          horses={[stallion1, mare1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.queryByText('Starlight')).not.toBeInTheDocument();
    });

    it('should only show female horses when filter is female', () => {
      render(
        <HorseSelector
          horses={[stallion1, mare1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="female"
          title="Select Dam"
        />
      );
      expect(screen.getByText('Starlight')).toBeInTheDocument();
      expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should filter horses by name', () => {
      render(
        <HorseSelector
          horses={[stallion1, stallion2]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const searchInput = screen.getByPlaceholderText('Search by name or breed...');
      fireEvent.change(searchInput, { target: { value: 'Thunder' } });

      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.queryByText('Lightning')).not.toBeInTheDocument();
    });

    it('should filter horses by breed', () => {
      render(
        <HorseSelector
          horses={[stallion1, stallion2]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const searchInput = screen.getByPlaceholderText('Search by name or breed...');
      fireEvent.change(searchInput, { target: { value: 'Arabian' } });

      expect(screen.getByText('Lightning')).toBeInTheDocument();
      expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
    });

    it('should be case-insensitive', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const searchInput = screen.getByPlaceholderText('Search by name or breed...');
      fireEvent.change(searchInput, { target: { value: 'THUNDER' } });

      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });

    it('should show all horses when search is cleared', () => {
      render(
        <HorseSelector
          horses={[stallion1, stallion2]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const searchInput = screen.getByPlaceholderText('Search by name or breed...');
      fireEvent.change(searchInput, { target: { value: 'Thunder' } });
      fireEvent.change(searchInput, { target: { value: '' } });

      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Lightning')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no horses match filter', () => {
      render(
        <HorseSelector
          horses={[mare1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByText('No stallions found')).toBeInTheDocument();
    });

    it('should show empty state when search returns no results', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const searchInput = screen.getByPlaceholderText('Search by name or breed...');
      fireEvent.change(searchInput, { target: { value: 'NonexistentHorse' } });

      expect(screen.getByText('No stallions found')).toBeInTheDocument();
    });

    it('should show "No mares found" for female filter', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="female"
          title="Select Dam"
        />
      );
      expect(screen.getByText('No mares found')).toBeInTheDocument();
    });
  });

  describe('horse list display', () => {
    it('should display horse name', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });

    it('should display breed name', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByText(/Thoroughbred/)).toBeInTheDocument();
    });

    it('should display age', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByText(/5 years old/)).toBeInTheDocument();
    });

    it('should display health status when present', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );
      expect(screen.getByText(/healthy/i)).toBeInTheDocument();
    });
  });

  describe('disabled horses', () => {
    it('should disable young horses', () => {
      render(
        <HorseSelector
          horses={[youngStallion]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const button = screen.getByRole('button', { name: /Select Junior/i });
      expect(button).toBeDisabled();
      expect(screen.getByText(/Too young \(2y, needs 3\+y\)/)).toBeInTheDocument();
    });

    it('should disable injured horses', () => {
      const injuredHorse = createHorse({
        id: 5,
        name: 'Limpy',
        sex: 'Male',
        age: 5,
        healthStatus: 'injured',
      });

      render(
        <HorseSelector
          horses={[injuredHorse]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const button = screen.getByRole('button', { name: /Select Limpy/i });
      expect(button).toBeDisabled();
      expect(screen.getByText('Injured')).toBeInTheDocument();
    });

    it('should disable horses on cooldown', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 5);
      const cooldownHorse = createHorse({
        id: 6,
        name: 'Resting',
        sex: 'Male',
        age: 5,
        breedingCooldownEndsAt: tomorrow.toISOString(),
      });

      render(
        <HorseSelector
          horses={[cooldownHorse]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const button = screen.getByRole('button', { name: /Select Resting/i });
      expect(button).toBeDisabled();
      expect(screen.getByText(/Cooldown \(\d+d remaining\)/)).toBeInTheDocument();
    });
  });

  describe('selection behavior', () => {
    it('should call onSelect when available horse is clicked', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const button = screen.getByRole('button', { name: /Select Thunder/i });
      fireEvent.click(button);

      expect(mockOnSelect).toHaveBeenCalledWith(stallion1);
    });

    it('should not call onSelect when disabled horse is clicked', () => {
      render(
        <HorseSelector
          horses={[youngStallion]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const button = screen.getByRole('button', { name: /Select Junior/i });
      fireEvent.click(button);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });

    it('should show selected state for selected horse', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={stallion1}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      expect(screen.getByText('✓ Selected')).toBeInTheDocument();
    });

    it('should have aria-pressed=true for selected horse', () => {
      render(
        <HorseSelector
          horses={[stallion1]}
          selectedHorse={stallion1}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const button = screen.getByRole('button', { name: /Select Thunder/i });
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('summary display', () => {
    it('should show available count', () => {
      render(
        <HorseSelector
          horses={[stallion1, youngStallion]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      expect(screen.getByText('1 of 2 available')).toBeInTheDocument();
    });

    it('should update available count based on filter results', () => {
      render(
        <HorseSelector
          horses={[stallion1, stallion2, youngStallion]}
          selectedHorse={null}
          onSelect={mockOnSelect}
          filter="male"
          title="Select Sire"
        />
      );

      expect(screen.getByText('2 of 3 available')).toBeInTheDocument();
    });
  });
});
