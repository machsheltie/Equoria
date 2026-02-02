import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import StableView from '../StableView';
import * as useHorsesModule from '../../hooks/api/useHorses';
import * as useAuthModule from '../../hooks/useAuth';

const horseCardMock = vi.fn();

vi.mock('../../components/HorseCard', () => ({
  default: (props: unknown) => {
    horseCardMock(props);
    return null;
  },
}));

vi.mock('../../components/FantasyTabs', () => ({
  FantasyTabs: ({
    tabs,
    defaultValue,
  }: {
    tabs: Array<{ value: string; content: React.ReactNode }>;
    defaultValue?: string;
  }) => {
    const selected = tabs.find((tab) => tab.value === defaultValue) || tabs[0];
    return <div data-testid="fantasy-tabs">{selected?.content}</div>;
  },
}));

vi.mock('../../hooks/api/useHorses', () => ({
  useHorses: vi.fn(),
}));

vi.mock('../../hooks/useAuth', async () => {
  const actual = await vi.importActual('../../hooks/useAuth');
  return {
    ...actual,
    useProfile: vi.fn(),
  };
});

describe('StableView', () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    horseCardMock.mockClear();
    vi.mocked(useHorsesModule.useHorses).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHorsesModule.useHorses>);

    vi.mocked(useAuthModule.useProfile).mockReturnValue({
      data: { user: { id: 1, money: 0, xp: 0, level: 1 } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAuthModule.useProfile>);
  });

  it('uses horse stats and primary discipline from API data', () => {
    vi.mocked(useHorsesModule.useHorses).mockReturnValue({
      data: [
        {
          id: 42,
          name: 'Aurora',
          ageYears: 5,
          sex: 'mare',
          stats: {
            speed: 92,
            stamina: 81,
            agility: 74,
            strength: 69,
            intelligence: 88,
            health: 95,
          },
          disciplineScores: {
            dressage: 72,
            show_jumping: 88,
          },
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHorsesModule.useHorses>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <StableView />
      </Wrapper>
    );

    expect(horseCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        horseName: 'Aurora',
        age: 5,
        stats: {
          speed: 92,
          stamina: 81,
          agility: 74,
          strength: 69,
          intelligence: 88,
          health: 95,
        },
        discipline: 'Show Jumping',
      })
    );
  });

  it('renders player stats from profile data', () => {
    vi.mocked(useAuthModule.useProfile).mockReturnValue({
      data: { user: { id: 1, money: 12345, xp: 9876, level: 12 } },
      isLoading: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useAuthModule.useProfile>);

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <StableView />
      </Wrapper>
    );

    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(screen.getByText('9,876')).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });
});
