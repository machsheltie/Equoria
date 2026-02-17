/**
 * HorseSelector Component Tests
 *
 * Story 6-1: Breeding Pair Selection
 * Tests for horse selection, filtering, and availability validation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HorseSelector from '../HorseSelector';
import type { Horse } from '@/types/breeding';

describe('HorseSelector - Story 6-1', () => {
  const mockHorses: Horse[] = [
    {
      id: 1,
      name: 'Thunder',
      age: 5,
      sex: 'Male',
      breedName: 'Thoroughbred',
      healthStatus: 'Healthy',
      dateOfBirth: '2019-01-01',
      canBreed: true,
    },
    {
      id: 2,
      name: 'Lightning',
      age: 4,
      sex: 'Female',
      breedName: 'Arabian',
      healthStatus: 'Healthy',
      dateOfBirth: '2020-01-01',
      canBreed: true,
    },
    {
      id: 3,
      name: 'Storm',
      age: 2,
      sex: 'Male',
      breedName: 'Quarter Horse',
      healthStatus: 'Healthy',
      dateOfBirth: '2022-01-01',
      canBreed: false,
    },
    {
      id: 4,
      name: 'Blaze',
      age: 6,
      sex: 'Male',
      breedName: 'Mustang',
      healthStatus: 'Injured',
      dateOfBirth: '2018-01-01',
      canBreed: false,
    },
    {
      id: 5,
      name: 'Sunshine',
      age: 5,
      sex: 'Female',
      breedName: 'Appaloosa',
      healthStatus: 'Healthy',
      dateOfBirth: '2019-06-01',
      breedingCooldownEndsAt: new Date(Date.now() + 86400000 * 10).toISOString(), // 10 days
      canBreed: false,
    },
  ];

  describe('Horse Filtering', () => {
    it('should display male horses when filter is "male"', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.getByText('Storm')).toBeInTheDocument();
      expect(screen.getByText('Blaze')).toBeInTheDocument();
      expect(screen.queryByText('Lightning')).not.toBeInTheDocument();
      expect(screen.queryByText('Sunshine')).not.toBeInTheDocument();
    });

    it('should display female horses when filter is "female"', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="female"
          title="Select Dam"
        />
      );

      expect(screen.getByText('Lightning')).toBeInTheDocument();
      expect(screen.getByText('Sunshine')).toBeInTheDocument();
      expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
      expect(screen.queryByText('Storm')).not.toBeInTheDocument();
      expect(screen.queryByText('Blaze')).not.toBeInTheDocument();
    });

    it('should filter horses by search term', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search by name or breed/i);
      await user.type(searchInput, 'Thunder');

      expect(screen.getByText('Thunder')).toBeInTheDocument();
      expect(screen.queryByText('Storm')).not.toBeInTheDocument();
      expect(screen.queryByText('Blaze')).not.toBeInTheDocument();
    });

    it('should filter horses by breed name', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search by name or breed/i);
      await user.type(searchInput, 'Mustang');

      expect(screen.getByText('Blaze')).toBeInTheDocument();
      expect(screen.queryByText('Thunder')).not.toBeInTheDocument();
      expect(screen.queryByText('Storm')).not.toBeInTheDocument();
    });
  });

  describe('Breeding Eligibility', () => {
    it('should disable horses under 3 years old', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const stormButton = screen.getByLabelText('Select Storm');
      expect(stormButton).toBeDisabled();
      expect(screen.getByText(/Too young \(2y, needs 3\+y\)/i)).toBeInTheDocument();
    });

    it('should disable injured horses', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const blazeButton = screen.getByLabelText('Select Blaze');
      expect(blazeButton).toBeDisabled();
      expect(screen.getByText('Injured')).toBeInTheDocument();
    });

    it('should disable horses on breeding cooldown', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="female"
          title="Select Dam"
        />
      );

      const sunshineButton = screen.getByLabelText('Select Sunshine');
      expect(sunshineButton).toBeDisabled();
      expect(screen.getByText(/Cooldown \(10d remaining\)/i)).toBeInTheDocument();
    });

    it('should enable horses that meet all requirements', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const thunderButton = screen.getByLabelText('Select Thunder');
      expect(thunderButton).not.toBeDisabled();
    });
  });

  describe('Horse Selection', () => {
    it('should call onSelect when eligible horse is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const thunderButton = screen.getByLabelText('Select Thunder');
      await user.click(thunderButton);

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Thunder',
        })
      );
    });

    it('should not call onSelect when disabled horse is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const stormButton = screen.getByLabelText('Select Storm');
      await user.click(stormButton);

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should highlight selected horse', () => {
      const onSelect = vi.fn();
      const selectedHorse = mockHorses[0]; // Thunder

      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={selectedHorse}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const thunderButton = screen.getByLabelText('Select Thunder');
      expect(thunderButton).toHaveClass('border-emerald-500', 'bg-emerald-50');
      expect(screen.getByText('✓ Selected')).toBeInTheDocument();
    });
  });

  describe('Display Information', () => {
    it('should display horse age and breed', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      expect(screen.getByText(/Thoroughbred • 5 years old/i)).toBeInTheDocument();
      expect(screen.getByText(/Quarter Horse • 2 years old/i)).toBeInTheDocument();
    });

    it('should display health status', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const healthElements = screen.getAllByText(/Healthy|Injured/i);
      expect(healthElements.length).toBeGreaterThan(0);
    });

    it('should display availability summary', () => {
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      // 1 of 3 male horses is available (Thunder)
      expect(screen.getByText(/1 of 3 available/i)).toBeInTheDocument();
    });

    it('should show "No horses found" when no matches', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const searchInput = screen.getByPlaceholderText(/search by name or breed/i);
      await user.type(searchInput, 'NonexistentHorse');

      expect(screen.getByText(/No stallions found/i)).toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should sort available horses before unavailable ones', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <HorseSelector
          horses={mockHorses}
          selectedHorse={null}
          onSelect={onSelect}
          filter="male"
          title="Select Sire"
        />
      );

      const horseButtons = container.querySelectorAll('button[aria-label^="Select"]');
      const horseNames = Array.from(horseButtons).map(
        (button) => button.querySelector('[class*="font-medium"]')?.textContent
      );

      // Thunder (available) should come before Storm (too young) and Blaze (injured)
      expect(horseNames[0]).toBe('Thunder');
    });
  });
});
