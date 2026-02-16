/**
 * Tests for MilestoneDot Component
 *
 * Testing Sprint - Story 6-2: Foal Milestone Timeline
 * Epic 6 Technical Debt Resolution
 *
 * Tests cover:
 * - Dot rendering with coordinates
 * - Color coding for completed/current/pending states
 * - Size variation for current milestone
 * - Checkmark display for completed milestones
 * - Pulsing ring for current milestone
 * - Null handling when no data
 * - Accessibility features
 * - SVG element structure
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MilestoneDot from '../MilestoneDot';

describe('MilestoneDot Component', () => {
  describe('null handling', () => {
    it('should return null when cx is undefined', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      expect(container.querySelector('g')).not.toBeInTheDocument();
    });

    it('should return null when cy is undefined', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      expect(container.querySelector('g')).not.toBeInTheDocument();
    });

    it('should return null when payload is undefined', () => {
      const { container } = render(
        <svg>
          <MilestoneDot cx={50} cy={50} />
        </svg>
      );
      expect(container.querySelector('g')).not.toBeInTheDocument();
    });

    it('should render when all required props are provided', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      expect(container.querySelector('g')).toBeInTheDocument();
    });
  });

  describe('completed milestone', () => {
    it('should render with green color when completed', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{
              completed: true,
              current: false,
              status: 'completed',
              name: 'Completed Milestone',
            }}
          />
        </svg>
      );
      const circle = container.querySelector('circle');
      expect(circle).toHaveAttribute('fill', '#10b981'); // green-500
    });

    it('should display checkmark for completed milestone', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: true, current: false, status: 'completed', name: 'Completed' }}
          />
        </svg>
      );
      const checkmark = container.querySelector('path');
      expect(checkmark).toBeInTheDocument();
      expect(checkmark).toHaveAttribute('stroke', '#ffffff');
    });

    it('should use standard radius for completed milestone', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: true, current: false, status: 'completed', name: 'Completed' }}
          />
        </svg>
      );
      const circle = container.querySelector('circle');
      expect(circle).toHaveAttribute('r', '6');
    });

    it('should have white stroke for outer circle', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: true, current: false, status: 'completed', name: 'Completed' }}
          />
        </svg>
      );
      const circle = container.querySelector('circle');
      expect(circle).toHaveAttribute('stroke', '#ffffff');
      expect(circle).toHaveAttribute('stroke-width', '2');
    });
  });

  describe('current milestone', () => {
    it('should render with blue color when current', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{
              completed: false,
              current: true,
              status: 'current',
              name: 'Current Milestone',
            }}
          />
        </svg>
      );
      const circles = container.querySelectorAll('circle');
      // First circle should be blue
      expect(circles[0]).toHaveAttribute('fill', '#3b82f6'); // blue-500
    });

    it('should use larger radius for current milestone', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: true, status: 'current', name: 'Current' }}
          />
        </svg>
      );
      const mainCircle = container.querySelectorAll('circle')[0];
      expect(mainCircle).toHaveAttribute('r', '8');
    });

    it('should display pulsing ring for current milestone', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: true, status: 'current', name: 'Current' }}
          />
        </svg>
      );
      const circles = container.querySelectorAll('circle');
      // Should have multiple circles (main + pulse ring + click target)
      expect(circles.length).toBeGreaterThan(1);

      // Find the pulse ring (has animate-pulse class)
      const pulseRing = Array.from(circles).find((circle) =>
        circle.className.baseVal?.includes('animate-pulse')
      );
      expect(pulseRing).toBeInTheDocument();
    });

    it('should have correct pulse ring attributes', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: true, status: 'current', name: 'Current' }}
          />
        </svg>
      );
      const pulseRing = Array.from(container.querySelectorAll('circle')).find((circle) =>
        circle.className.baseVal?.includes('animate-pulse')
      );
      expect(pulseRing).toHaveAttribute('r', '12'); // radius + 4
      expect(pulseRing).toHaveAttribute('fill', 'none');
      expect(pulseRing).toHaveAttribute('opacity', '0.3');
    });

    it('should not display checkmark for current milestone', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: true, status: 'current', name: 'Current' }}
          />
        </svg>
      );
      const checkmark = container.querySelector('path');
      expect(checkmark).not.toBeInTheDocument();
    });
  });

  describe('pending milestone', () => {
    it('should render with gray color when pending', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{
              completed: false,
              current: false,
              status: 'pending',
              name: 'Pending Milestone',
            }}
          />
        </svg>
      );
      const circle = container.querySelector('circle');
      expect(circle).toHaveAttribute('fill', '#9ca3af'); // gray-400
    });

    it('should use standard radius for pending milestone', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Pending' }}
          />
        </svg>
      );
      const circle = container.querySelector('circle');
      expect(circle).toHaveAttribute('r', '6');
    });

    it('should not display checkmark for pending milestone', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Pending' }}
          />
        </svg>
      );
      const checkmark = container.querySelector('path');
      expect(checkmark).not.toBeInTheDocument();
    });

    it('should not display pulse ring for pending milestone', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Pending' }}
          />
        </svg>
      );
      const pulseRing = Array.from(container.querySelectorAll('circle')).find((circle) =>
        circle.className.baseVal?.includes('animate-pulse')
      );
      expect(pulseRing).not.toBeInTheDocument();
    });
  });

  describe('coordinate positioning', () => {
    it('should position dot at specified coordinates', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={100}
            cy={200}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      const circle = container.querySelector('circle');
      expect(circle).toHaveAttribute('cx', '100');
      expect(circle).toHaveAttribute('cy', '200');
    });

    it('should position checkmark relative to coordinates', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={100}
            cy={200}
            payload={{ completed: true, current: false, status: 'completed', name: 'Test' }}
          />
        </svg>
      );
      const checkmark = container.querySelector('path');
      const dAttribute = checkmark?.getAttribute('d');
      expect(dAttribute).toContain('100'); // Contains cx value
      expect(dAttribute).toContain('200'); // Contains cy value
    });
  });

  describe('accessibility', () => {
    it('should have larger click target for accessibility', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{
              completed: false,
              current: false,
              status: 'pending',
              name: 'Test Milestone',
            }}
          />
        </svg>
      );
      const circles = container.querySelectorAll('circle');
      const clickTarget = Array.from(circles).find(
        (circle) => circle.getAttribute('fill') === 'transparent'
      );
      expect(clickTarget).toBeInTheDocument();
      expect(clickTarget).toHaveAttribute('r', '12'); // radius + 6
    });

    it('should have cursor pointer on click target', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      const clickTarget = Array.from(container.querySelectorAll('circle')).find(
        (circle) => circle.getAttribute('fill') === 'transparent'
      );
      expect(clickTarget).toHaveStyle({ cursor: 'pointer' });
    });

    it('should have aria-label for milestone name', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Socialization' }}
          />
        </svg>
      );
      const clickTarget = Array.from(container.querySelectorAll('circle')).find((circle) =>
        circle.getAttribute('aria-label')
      );
      expect(clickTarget).toHaveAttribute('aria-label', 'Socialization milestone');
    });
  });

  describe('SVG structure', () => {
    it('should wrap elements in a g group', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      expect(container.querySelector('g')).toBeInTheDocument();
    });

    it('should have transition class on main circle', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      const mainCircle = container.querySelectorAll('circle')[0];
      expect(mainCircle.className.baseVal).toContain('transition-all');
    });
  });

  describe('edge cases', () => {
    it('should handle zero coordinates', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={0}
            cy={0}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      const circle = container.querySelector('circle');
      expect(circle).toHaveAttribute('cx', '0');
      expect(circle).toHaveAttribute('cy', '0');
    });

    it('should handle empty name in payload', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: '' }}
          />
        </svg>
      );
      const clickTarget = Array.from(container.querySelectorAll('circle')).find((circle) =>
        circle.getAttribute('aria-label')
      );
      expect(clickTarget).toHaveAttribute('aria-label', ' milestone');
    });

    it('should handle partial payload data', () => {
      const { container } = render(
        <svg>
          <MilestoneDot
            cx={50}
            cy={50}
            payload={{ completed: false, current: false, status: 'pending', name: 'Test' }}
          />
        </svg>
      );
      expect(container.querySelector('circle')).toBeInTheDocument();
    });
  });
});
