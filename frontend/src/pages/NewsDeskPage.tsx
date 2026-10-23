/**
 * The News Desk (Equoria-wbt8l; owner rulings 2026-10-23): where the owner
 * (Head Admin) and Admins write News. Staff tooling, plain and open like the
 * Steward's Office: a title, the writing form, then the posts so far.
 *
 * Reached from the News page's "Write for the News" link, shown only to
 * admin-level accounts; anyone else gets the ordinary not-found page. The
 * server decides which post types this writer may use.
 */

import { useState } from 'react';
import { Link } from 'react-router';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { ErrorState, InlineError, SectionLoading } from '@/components/ui/state';
import { useAuth } from '@/contexts/AuthContext';
import { useDeleteNewsPost, useNewsDesk } from '@/hooks/api/useNews';
import { actionMessageFor } from '@/lib/http/actionMessage';
import { userMessageFor } from '@/lib/http/userMessage';
import type { NewsDeskPost, StaffNewsPostType } from '@/lib/api/news';
import { NewsPostForm } from '@/components/news/desk/NewsPostForm';
import { deskRefused, deskTypeCopy } from '@/components/news/desk/newsDeskTypes';
import { formatGameDate } from '@/components/news/newsRoad';
import '@/components/news/desk/newsDesk.css';
import NotFoundPage from './NotFoundPage';

function PostLine({
  post,
  signatureName,
  onEdit,
}: {
  post: NewsDeskPost;
  signatureName: string;
  onEdit: (post: NewsDeskPost) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteNewsPost();
  const label = deskTypeCopy(
    post.postType as StaffNewsPostType,
    post.authorName ?? signatureName
  ).label;
  return (
    <li className="news-desk-post">
      <div>
        <p className="news-desk-post__type">{label}</p>
        <p className="news-desk-post__title">{post.title}</p>
        <p className="news-desk-post__when">
          {post.scheduled ? 'Goes out ' : 'Posted '}
          <time dateTime={post.gameDate}>{formatGameDate(post.gameDate)}</time>
          {post.authorName ? ` · ${post.authorName}` : ''}
        </p>
      </div>
      {post.canChange && (
        <div className="news-desk-post__actions">
          {confirming ? (
            <>
              <span className="news-desk-note">Remove this post from News?</span>
              <Button
                type="button"
                variant="destructive"
                pending={remove.isPending}
                onClick={() => remove.mutate(post.id)}
              >
                Remove
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => onEdit(post)}>
                Edit
              </Button>
              <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
                Remove
              </Button>
            </>
          )}
          {remove.isError && <InlineError message={actionMessageFor(remove.error, deskRefused)} />}
        </div>
      )}
    </li>
  );
}

export default function NewsDeskPage() {
  const { isAdmin } = useAuth();
  const desk = useNewsDesk(isAdmin);
  const [editing, setEditing] = useState<NewsDeskPost | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isAdmin) {
    return <NotFoundPage />;
  }

  let content: React.ReactNode;
  if (desk.isPending) {
    content = <SectionLoading label="Opening the News Desk…" />;
  } else if (desk.isError) {
    const { message, retryable } = userMessageFor(desk.error);
    content = (
      <ErrorState
        title="The News Desk didn't open"
        message={message}
        retry={retryable ? { label: 'Try again', onClick: () => void desk.refetch() } : undefined}
      />
    );
  } else {
    const data = desk.data;
    content = (
      <div className="news-desk-areas">
        <section aria-labelledby="news-desk-write">
          <h2 id="news-desk-write">{editing ? 'Edit the post' : 'Write a post'}</h2>
          <div className="news-desk-rule" aria-hidden="true" />
          <NewsPostForm
            key={editing ? `edit-${editing.id}` : 'new'}
            desk={data}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
            onDone={(message) => {
              setNotice(message);
              setEditing(null);
            }}
          />
          {notice && (
            <p className="news-desk-notice" role="status">
              {notice}
            </p>
          )}
        </section>

        <section aria-labelledby="news-desk-posts">
          <h2 id="news-desk-posts">Posts so far</h2>
          <div className="news-desk-rule" aria-hidden="true" />
          {data.posts.length === 0 ? (
            <p className="news-desk-note">Nothing has been written at the desk yet.</p>
          ) : (
            <ul className="news-desk-posts">
              {data.posts.map((post) => (
                <PostLine
                  key={post.id}
                  post={post}
                  signatureName={data.signature.name}
                  onEdit={(p) => {
                    setNotice(null);
                    setEditing(p);
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  return (
    <PageContainer variant="narrow" className="news-desk" data-testid="news-desk">
      <header className="news-desk-header">
        <h1>The News Desk</h1>
        <p>What you post here appears on the Night Road for every player.</p>
        <Link to="/news" className="news-desk-back">
          Back to News
        </Link>
      </header>
      {content}
    </PageContainer>
  );
}
