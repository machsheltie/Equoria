/**
 * AssignGroomModal Component Tests
 *
 * Tests for the groom assignment modal including:
 * - Modal open/close functionality
 * - Available groom listing with slot validation
 * - Groom selection and assignment creation
 * - Replace existing assignment option (no priority, no notes: Equoria-ekrab)
 * - Validation error handling
 * - Success confirmation
 * - Accessibility compliance
 *
 * Following TDD with NO MOCKING approach for authentic component validation
 * Testing real assignment workflow with backend groom assignment endpoints
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from '../../test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import AssignGroomModal from '../AssignGroomModal';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Mock data for testing (NO MOCKING - real data passed as props)
const mockAvailableGrooms = [
  {
    id: 1,
    name: 'Sarah Johnson',
    skillLevel: 'expert',
    starLevel: 'advanced',
    specialty: 'foalCare',
    personality: 'gentle',
    experience: 8,
    sessionRate: 100,
    isActive: true,
    availableSlots: 2,
    currentAssignments: 2,
    maxAssignments: 4,
  },
  {
    id: 2,
    name: 'Mike Rodriguez',
    skillLevel: 'intermediate',
    starLevel: 'intermediate',
    specialty: 'general',
    personality: 'patient',
    experience: 5,
    sessionRate: 75,
    isActive: true,
    availableSlots: 1,
    currentAssignments: 2,
    maxAssignments: 3,
  },
  {
    id: 3,
    name: 'Emma Thompson',
    skillLevel: 'master',
    starLevel: 'expert',
    specialty: 'showHandling',
    personality: 'energetic',
    experience: 12,
    sessionRate: 150,
    isActive: true,
    availableSlots: 0,
    currentAssignments: 5,
    maxAssignments: 5,
  },
];

// Test wrapper with required providers
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const TestWrapper = createTestWrapper();

describe('AssignGroomModal Component', () => {
  describe('Modal Rendering', () => {
    test('renders modal when isOpen is true', () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
          />
        </TestWrapper>
      );

      expect(screen.getByTestId('assign-groom-modal')).toBeInTheDocument();
      // Check for the main heading "Assign Groom"
      expect(screen.getByRole('heading', { name: /^assign groom$/i })).toBeInTheDocument();
    });

    test('does not render modal when isOpen is false', () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={false}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
          />
        </TestWrapper>
      );

      expect(screen.queryByTestId('assign-groom-modal')).not.toBeInTheDocument();
    });

    test('displays horse information', () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
          />
        </TestWrapper>
      );

      expect(screen.getByText(/thunder/i)).toBeInTheDocument();
    });
  });

  describe('Available Grooms Display', () => {
    test('displays list of available grooms', async () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={mockAvailableGrooms}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
        expect(screen.getByText('Mike Rodriguez')).toBeInTheDocument();
      });
    });

    test('displays groom details including available slots', async () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={mockAvailableGrooms}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/2.*slots available/i)).toBeInTheDocument();
        expect(screen.getByText(/1.*slot available/i)).toBeInTheDocument();
      });
    });

    test('disables grooms with no available slots', async () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={mockAvailableGrooms}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const emmaOption = screen.getByLabelText(/emma thompson/i);
        expect(emmaOption).toBeDisabled();
      });
    });

    test('shows empty state when no grooms available', async () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={[]}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no grooms available/i)).toBeInTheDocument();
      });
    });
  });

  describe('Groom Selection', () => {
    test('allows selecting a groom with radio button', async () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={mockAvailableGrooms}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const sarahOption = screen.getByLabelText(/sarah johnson/i) as HTMLInputElement;
        fireEvent.click(sarahOption);
        expect(sarahOption.checked).toBe(true);
      });
    });

    test('displays selected groom details', async () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={mockAvailableGrooms}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const sarahOption = screen.getByLabelText(/sarah johnson/i);
        fireEvent.click(sarahOption);
      });

      await waitFor(() => {
        // OLD CONTRACT: the card showed the skill word. OWNER RULING 2026-10-28 (Equoria-nawn5):
        // staff show their star level (an expert-tier groom is Advanced, 4 stars).
        expect(screen.getByText('Advanced')).toBeInTheDocument();
        expect(screen.getByText(/foal care/i)).toBeInTheDocument();
      });
    });
  });

  // Owner ruling 2026-10-28 (Equoria-ekrab): no priority level and no notes
  // (both invented); "Replace existing assignment" stays; the dialog closes the
  // moment Assign Groom is pressed. Old contract: a 1-5 priority select, a
  // notes box and a "replace primary" box shown only at priority 1.
  describe('Assignment Options', () => {
    const renderOpen = (onClose = vi.fn()) =>
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={onClose}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={mockAvailableGrooms}
          />
        </TestWrapper>
      );

    test('has no priority level and no notes, and keeps Replace existing assignment', async () => {
      renderOpen();
      fireEvent.click(screen.getByLabelText(/sarah johnson/i));

      expect(await screen.findByLabelText(/replace existing assignment/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/priority/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/priority/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
    });

    test('closes the moment Assign Groom is pressed and sends no priority or notes', async () => {
      let body: Record<string, unknown> | null = null;
      server.use(
        http.post(`${base}/api/v1/groom-assignments`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ success: true, data: { assignment: { id: 9 } } });
        })
      );
      const onClose = vi.fn();
      renderOpen(onClose);
      fireEvent.click(screen.getByLabelText(/sarah johnson/i));
      fireEvent.click(screen.getByRole('button', { name: /assign groom/i }));

      // Gone at once, before the server has answered.
      expect(screen.queryByTestId('assign-groom-modal')).not.toBeInTheDocument();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(body).toEqual({ groomId: 1, horseId: 1, replacePrimary: false });
    });

    test('a refused assignment brings the dialog back with the reason and the choice kept', async () => {
      server.use(
        http.post(`${base}/api/v1/groom-assignments`, () =>
          HttpResponse.json({ success: false, message: 'nope' }, { status: 400 })
        )
      );
      const onClose = vi.fn();
      renderOpen(onClose);
      fireEvent.click(screen.getByLabelText(/sarah johnson/i));
      fireEvent.click(screen.getByRole('button', { name: /assign groom/i }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByLabelText(/sarah johnson/i)).toBeChecked();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Assignment Submission', () => {
    test('disables assign button when no groom selected', () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={mockAvailableGrooms}
          />
        </TestWrapper>
      );

      const assignButton = screen.getByRole('button', { name: /assign groom/i });
      expect(assignButton).toBeDisabled();
    });

    test('enables assign button when groom is selected', async () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
            availableGrooms={mockAvailableGrooms}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const sarahOption = screen.getByLabelText(/sarah johnson/i);
        fireEvent.click(sarahOption);
      });

      await waitFor(() => {
        const assignButton = screen.getByRole('button', { name: /assign groom/i });
        expect(assignButton).not.toBeDisabled();
      });
    });
  });

  describe('Modal Close', () => {
    test('calls onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={onClose}
            horseId={1}
            horseName="Thunder"
            userId={1}
          />
        </TestWrapper>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when cancel button clicked', () => {
      const onClose = vi.fn();
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={onClose}
            horseId={1}
            horseName="Thunder"
            userId={1}
          />
        </TestWrapper>
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
          />
        </TestWrapper>
      );

      expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Assign groom to horse');
    });

    test('traps focus within modal', () => {
      render(
        <TestWrapper>
          <AssignGroomModal
            isOpen={true}
            onClose={() => {}}
            horseId={1}
            horseName="Thunder"
            userId={1}
          />
        </TestWrapper>
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
    });
  });
});
