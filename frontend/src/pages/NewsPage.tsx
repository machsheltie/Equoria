/**
 * Equoria News — the Night Road (Equoria-wbt8l; owner rulings 2026-10-23,
 * layout Option B chosen by the owner).
 *
 * Experiential concept: every dawn the game writes down what happened in the
 * night; News is the road of nights the player walks back along. Players
 * arrive here from While You Were Away's "Okay".
 *
 * Honest states (FRONTEND_ASYNC_STATE_DOCTRINE): loading, error with a real
 * "Try again", empty only after a successful load, then the road. No unread
 * markers (owner ruling).
 */

import { Link } from 'react-router';
import { PageContainer } from '@/components/layout/PageContainer';
import PageHero from '@/components/layout/PageHero';
import { Surface } from '@/components/ui/Surface';
import { Button } from '@/components/ui/button';
import { ErrorState, InlineError } from '@/components/ui/state';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useNewsFeed } from '@/hooks/api/useNews';
import { userMessageFor } from '@/lib/http/userMessage';
import { MonthRibbon, NightRoad } from '@/components/news/NightRoad';
import { NewsEmblem } from '@/components/news/NewsEmblem';
import '@/components/news/news.css';

export default function NewsPage() {
  const { isAdmin } = useAuth();
  const feed = useNewsFeed();

  let content: React.ReactNode;
  if (feed.isPending) {
    content = (
      <div className="news-loading" role="status" aria-busy="true">
        <NewsEmblem name="moon" />
        Fetching the news&hellip;
      </div>
    );
  } else if (feed.isError) {
    content = (
      <ErrorState
        title="The news didn't arrive"
        message={`We couldn't load News just now. Your horses are fine. ${userMessageFor(feed.error).message}`}
        retry={{ label: 'Try again', onClick: () => void feed.refetch() }}
      />
    );
  } else {
    const [first] = feed.data.pages;
    const items = feed.data.pages.flatMap((page) => page.items);
    const today = first.today;
    const seasonal = (first.ahead ?? []).find((item) => item.postType === 'seasonalEvent');
    const ahead = (first.ahead ?? []).filter((item) => item.postType !== 'seasonalEvent');

    content =
      items.length === 0 && ahead.length === 0 ? (
        <EmptyState
          variant="first-use"
          icon={<NewsEmblem name="star" />}
          title="Nothing new under the stars"
          description="No news has been posted yet. The game adds entries at the start of each game day."
        />
      ) : (
        <>
          {seasonal && (
            <MonthRibbon
              event={seasonal}
              today={today}
              postOnRoad={items.some((item) => item.id === seasonal.id)}
            />
          )}
          <NightRoad items={items} ahead={ahead} today={today} />
          {(feed.hasNextPage || feed.isFetchNextPageError) && (
            <div className="news-road-end">
              {feed.isFetchNextPageError && (
                <InlineError
                  message={`Earlier nights didn't load. ${userMessageFor(feed.error).message}`}
                />
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => void feed.fetchNextPage()}
                pending={feed.isFetchingNextPage}
              >
                Walk further back
              </Button>
            </div>
          )}
        </>
      );
  }

  return (
    <div data-testid="news-page">
      <PageHero
        title="Equoria News"
        subtitle="Written each dawn, Equoria time, by the game and the people who run it."
      >
        {isAdmin && (
          <Link to="/news/desk" className="news-desk-link">
            Write for the News
          </Link>
        )}
      </PageHero>

      {/* Banner image in glass card */}
      <PageContainer variant="content" padded={false} className="pt-1 pb-4">
        <Surface variant="panel">
          <img
            src="/images/equorianews.webp"
            alt="Equoria News"
            className="w-full h-auto rounded-[var(--radius-md)]"
          />
        </Surface>
      </PageContainer>

      <PageContainer variant="content" className="news-page">
        {content}
      </PageContainer>
    </div>
  );
}
