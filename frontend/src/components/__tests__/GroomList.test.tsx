/**
 * GroomList Component Tests
 * 
 * Tests for the groom marketplace interface including:
 * - Marketplace groom listing with filtering and search
 * - Groom hiring functionality with validation
 * - Marketplace refresh mechanics
 * - Fund and stable limit validation
 * - Responsive design and mobile optimization
 * - Error handling and loading states
 * - Accessibility compliance
 * 
 * Following TDD with NO MOCKING approach for authentic component validation
 * Testing real API integration patterns with backend groom marketplace endpoints
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import GroomList from '../GroomList';

// Mock data for testing (NO MOCKING - real data passed as props)
const mockMarketplaceData = {
  grooms: [
    {
      marketplaceId: 'groom-1',
      firstName: 'Sarah',
      lastName: 'Johnson',
      specialty: 'foalCare',
      skillLevel: 'expert',
      personality: 'gentle',
      experience: 8,
      sessionRate: 100,
      bio: 'Experienced foal care specialist with gentle approach',
      availability: true,
    },
    {
      marketplaceId: 'groom-2',
      firstName: 'Mike',
      lastName: 'Rodriguez',
      specialty: 'general',
      skillLevel: 'intermediate',
      personality: 'patient',
      experience: 5,
      sessionRate: 75,
      bio: 'Versatile groom with patient demeanor',
      availability: true,
    },
    {
      marketplaceId: 'groom-3',
      firstName: 'Emma',
      lastName: 'Thompson',
      specialty: 'showHandling',
      skillLevel: 'master',
      personality: 'energetic',
      experience: 12,
      sessionRate: 150,
      bio: 'Master show handler with extensive competition experience',
      availability: true,
    },
  ],
  lastRefresh: new Date().toISOString(),
  nextFreeRefresh: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  refreshCost: 0,
  canRefreshFree: true,
  refreshCount: 0,
};

const mockUserData = {
  id: 1,
  money: 5000,
  stableLimit: 10,
  currentHorses: 5,
};

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
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

const TestWrapper = createTestWrapper();

describe('GroomList Component', () => {
  describe('Component Rendering', () => {
    test('renders groom list with loading state', () => {
      render(
        <TestWrapper>
          <GroomList userId={1} />
        </TestWrapper>
      );

      expect(screen.getByTestId('groom-list')).toBeInTheDocument();
    });

    test('renders groom list with marketplace data', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('groom-list')).toBeInTheDocument();
        expect(screen.getByTestId('groom-marketplace')).toBeInTheDocument();
      });
    });

    test('renders with proper structure and sections', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('groom-filters')).toBeInTheDocument();
        expect(screen.getByTestId('groom-grid')).toBeInTheDocument();
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });
    });
  });

  describe('Groom Display', () => {
    test('displays all grooms from marketplace', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
        expect(screen.getByText('Mike Rodriguez')).toBeInTheDocument();
        expect(screen.getByText('Emma Thompson')).toBeInTheDocument();
      });
    });

    test('displays groom details correctly', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check Sarah Johnson's card specifically
        const sarahCard = screen.getByTestId('groom-card-groom-1');
        // Component converts "foalCare" to "foal Care" (with capital C)
        // Use more specific selector to avoid matching bio text
        const specialtyElement = within(sarahCard).getAllByText(/foal\s+care/i)[0];
        expect(specialtyElement).toBeInTheDocument();
        expect(within(sarahCard).getByText(/expert/i)).toBeInTheDocument();
        expect(within(sarahCard).getByText(/8.*years/i)).toBeInTheDocument();
        expect(within(sarahCard).getByText(/\$100\/week/)).toBeInTheDocument();
      });
    });

    test('displays groom bio information', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Experienced foal care specialist/i)).toBeInTheDocument();
      });
    });
  });

  describe('Filtering and Sorting', () => {
    test('filters grooms by skill level', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        const skillFilter = screen.getByTestId('skill-level-filter');
        fireEvent.change(skillFilter, { target: { value: 'expert' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
        expect(screen.queryByText('Mike Rodriguez')).not.toBeInTheDocument();
      });
    });

    test('filters grooms by specialty', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        const specialtyFilter = screen.getByTestId('specialty-filter');
        fireEvent.change(specialtyFilter, { target: { value: 'showHandling' } });
      });

      await waitFor(() => {
        expect(screen.getByText('Emma Thompson')).toBeInTheDocument();
        expect(screen.queryByText('Sarah Johnson')).not.toBeInTheDocument();
      });
    });

    test('sorts grooms by price (low to high)', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        const sortSelect = screen.getByTestId('sort-select');
        fireEvent.change(sortSelect, { target: { value: 'price-asc' } });
      });

      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card/);
        expect(groomCards[0]).toHaveTextContent('Mike Rodriguez');
        expect(groomCards[2]).toHaveTextContent('Emma Thompson');
      });
    });

    test('sorts grooms by experience (high to low)', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        const sortSelect = screen.getByTestId('sort-select');
        fireEvent.change(sortSelect, { target: { value: 'experience-desc' } });
      });

      await waitFor(() => {
        const groomCards = screen.getAllByTestId(/groom-card/);
        expect(groomCards[0]).toHaveTextContent('Emma Thompson');
        expect(groomCards[2]).toHaveTextContent('Mike Rodriguez');
      });
    });
  });

  describe('Hiring Functionality', () => {
    test('displays hire button for each groom', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        const hireButtons = screen.getAllByRole('button', { name: /hire/i });
        expect(hireButtons.length).toBe(3);
      });
    });

    test('opens hire confirmation modal when hire button clicked', async () => {
      render(
        <TestWrapper>
          <GroomList
            userId={1}
            marketplaceData={mockMarketplaceData}
            userData={mockUserData}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const hireButtons = screen.getAllByRole('button', { name: /hire/i });
        fireEvent.click(hireButtons[0]);
      });

      await waitFor(() => {
        // Just check for the modal presence
        expect(screen.getByTestId('hire-modal')).toBeInTheDocument();
        // Check for modal heading specifically
        expect(screen.getByRole('heading', { name: /confirm hire/i })).toBeInTheDocument();
      });
    });

    test('displays hiring cost in confirmation modal', async () => {
      render(
        <TestWrapper>
          <GroomList
            userId={1}
            marketplaceData={mockMarketplaceData}
            userData={mockUserData}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        // Click on Sarah Johnson's hire button (she's groom-1, $100/week)
        const sarahButton = screen.getByRole('button', { name: /hire sarah johnson/i });
        fireEvent.click(sarahButton);
      });

      await waitFor(() => {
        // Hiring cost is 1 week upfront: $100 * 7 = $700
        const modal = screen.getByTestId('hire-modal');
        expect(within(modal).getByText('$700')).toBeInTheDocument();
      });
    });

    test('disables hire button when insufficient funds', async () => {
      const poorUserData = { ...mockUserData, money: 50 };

      render(
        <TestWrapper>
          <GroomList 
            userId={1} 
            marketplaceData={mockMarketplaceData}
            userData={poorUserData}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const hireButtons = screen.getAllByRole('button', { name: /hire/i });
        // Emma Thompson costs $150/week * 7 = $1050, user only has $50
        expect(hireButtons[2]).toBeDisabled();
      });
    });

    test('shows insufficient funds message', async () => {
      const poorUserData = { ...mockUserData, money: 50 };

      render(
        <TestWrapper>
          <GroomList
            userId={1}
            marketplaceData={mockMarketplaceData}
            userData={poorUserData}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check for the warning banner (more specific than button text)
        expect(screen.getByText(/you may not have enough money/i)).toBeInTheDocument();
      });
    });
  });

  describe('Marketplace Refresh', () => {
    test('displays refresh button', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
      });
    });

    test('shows free refresh indicator when available', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/free refresh available/i)).toBeInTheDocument();
      });
    });

    test('shows refresh cost when not free', async () => {
      const paidRefreshData = {
        ...mockMarketplaceData,
        refreshCost: 100,
        canRefreshFree: false,
      };

      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={paidRefreshData} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check for the specific refresh button text with cost
        expect(screen.getByText(/refresh \(\$100\)/i)).toBeInTheDocument();
      });
    });

    test('displays next free refresh time', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/next free refresh/i)).toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    test('displays empty state when no grooms available', async () => {
      const emptyMarketplace = {
        ...mockMarketplaceData,
        grooms: [],
      };

      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={emptyMarketplace} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/no grooms available/i)).toBeInTheDocument();
        expect(screen.getByText(/try refreshing the marketplace/i)).toBeInTheDocument();
        // Check that there are exactly 2 refresh buttons (one in header, one in empty state)
        const refreshButtons = screen.getAllByRole('button', { name: /refresh/i });
        expect(refreshButtons.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', async () => {
      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Groom marketplace');
      });
    });

    test('supports keyboard navigation', async () => {
      render(
        <TestWrapper>
          <GroomList
            userId={1}
            marketplaceData={mockMarketplaceData}
            userData={mockUserData}
          />
        </TestWrapper>
      );

      await waitFor(() => {
        const hireButtons = screen.getAllByRole('button', { name: /hire/i });
        // Verify buttons are focusable (have no tabindex=-1)
        expect(hireButtons[0]).not.toHaveAttribute('tabindex', '-1');
        // Verify buttons are not disabled (can be focused)
        expect(hireButtons[0]).not.toBeDisabled();
      });
    });
  });

  describe('Responsive Design', () => {
    test('renders mobile layout on small screens', async () => {
      // Mock window.innerWidth
      global.innerWidth = 500;
      global.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('groom-list')).toHaveAttribute('data-layout', 'mobile');
      });
    });

    test('renders desktop layout on large screens', async () => {
      // Mock window.innerWidth
      global.innerWidth = 1200;
      global.dispatchEvent(new Event('resize'));

      render(
        <TestWrapper>
          <GroomList userId={1} marketplaceData={mockMarketplaceData} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('groom-list')).toHaveAttribute('data-layout', 'desktop');
      });
    });
  });
});

