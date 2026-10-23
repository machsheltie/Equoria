/**
 * NewsPostForm — write or edit one News post at the News Desk (Equoria-wbt8l).
 *
 * Owner ruling 2026-10-23: the post TYPE is chosen first and decides the
 * fields; then the writer fills it in and, for a seasonal event, uploads the
 * tile pictures. Only the types the server says this writer may use are
 * offered. The draft is kept until the server accepts it.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField, Input, Textarea } from '@/components/ui/form';
import { InlineError } from '@/components/ui/state';
import { useCreateNewsPost, useUpdateNewsPost, useUploadNewsImage } from '@/hooks/api/useNews';
import { actionMessageFor } from '@/lib/http/actionMessage';
import type { NewsDesk, NewsDeskPost, StaffNewsPostType } from '@/lib/api/news';
import {
  NEWS_BODY_MAX,
  NEWS_CAPTION_MAX,
  NEWS_TILES_MAX,
  NEWS_TITLE_MAX,
  deskRefused,
  deskTypeCopy,
  uploadRefused,
} from './newsDeskTypes';

interface DraftTile {
  key: number;
  imageUrl: string | null;
  caption: string;
  uploading: boolean;
  error: string | null;
}

interface Draft {
  postType: StaffNewsPostType | null;
  title: string;
  body: string;
  month: string;
  closesOn: string;
  tiles: DraftTile[];
}

let tileKey = 0;
const nextTileKey = () => (tileKey += 1);

function draftFrom(post: NewsDeskPost | null): Draft {
  return {
    postType: (post?.postType as StaffNewsPostType | undefined) ?? null,
    title: post?.title ?? '',
    body: post?.body ?? '',
    month: post?.month ?? '',
    closesOn: post?.closesOn ?? '',
    tiles: (post?.tiles ?? []).map((tile) => ({
      key: nextTileKey(),
      imageUrl: tile.imageUrl,
      caption: tile.caption,
      uploading: false,
      error: null,
    })),
  };
}

/** What is wrong with the draft, field by field (empty when it can be sent). */
function problemsOf(draft: Draft): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!draft.title.trim()) problems.title = 'Give the post a title.';
  else if (draft.title.trim().length > NEWS_TITLE_MAX)
    problems.title = `A title can be at most ${NEWS_TITLE_MAX} characters.`;
  if (!draft.body.trim()) problems.body = 'Write the post.';
  else if (draft.body.trim().length > NEWS_BODY_MAX)
    problems.body = `A post can be at most ${NEWS_BODY_MAX} characters.`;
  if (draft.postType === 'seasonalEvent') {
    if (!/^\d{4}-\d{2}$/.test(draft.month)) problems.month = 'Choose the month the event runs.';
    if (draft.tiles.some((t) => !t.imageUrl || !t.caption.trim()))
      problems.tiles = 'Each tile needs an uploaded picture and a caption.';
    else if (draft.tiles.some((t) => t.caption.trim().length > NEWS_CAPTION_MAX))
      problems.tiles = `A caption can be at most ${NEWS_CAPTION_MAX} characters.`;
  }
  return problems;
}

interface NewsPostFormProps {
  desk: NewsDesk;
  /** The post being edited, or null to write a new one. */
  editing: NewsDeskPost | null;
  onDone: (message: string) => void;
  onCancelEdit: () => void;
}

export function NewsPostForm({ desk, editing, onDone, onCancelEdit }: NewsPostFormProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(editing));
  const [showProblems, setShowProblems] = useState(false);
  const create = useCreateNewsPost();
  const update = useUpdateNewsPost();
  const upload = useUploadNewsImage();
  const saving = create.isPending || update.isPending;
  const saveError = editing ? update.error : create.error;

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setTile = (key: number, patch: Partial<DraftTile>) =>
    setDraft((d) => ({
      ...d,
      tiles: d.tiles.map((t) => (t.key === key ? { ...t, ...patch } : t)),
    }));

  const problems = problemsOf(draft);
  const shown = showProblems ? problems : {};
  const monthLocked = Boolean(editing && !editing.scheduled);

  async function choosePicture(key: number, file: File | undefined) {
    if (!file) return;
    setTile(key, { uploading: true, error: null });
    try {
      const { imageUrl } = await upload.mutateAsync(file);
      setTile(key, { uploading: false, imageUrl });
    } catch (error) {
      setTile(key, { uploading: false, error: actionMessageFor(error, uploadRefused) });
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.postType) return;
    if (Object.keys(problems).length > 0 || draft.tiles.some((t) => t.uploading)) {
      setShowProblems(true);
      return;
    }
    const fields = {
      title: draft.title.trim(),
      body: draft.body.trim(),
      ...(draft.postType === 'seasonalEvent'
        ? {
            month: draft.month,
            tiles: draft.tiles.map((t) => ({
              imageUrl: t.imageUrl ?? '',
              caption: t.caption.trim(),
            })),
          }
        : {}),
      ...(draft.postType === 'contest' ? { closesOn: draft.closesOn || null } : {}),
    };
    // A refusal is shown beside the save button (saveError) and the draft stays.
    if (editing) {
      update.mutate(
        { id: editing.id, input: fields },
        { onSuccess: () => onDone('Your changes are saved.') }
      );
      return;
    }
    create.mutate(
      { postType: draft.postType, ...fields },
      {
        onSuccess: ({ post }) => {
          onDone(
            post.scheduled ? 'Scheduled. It goes out at the start of the 1st.' : 'Posted to News.'
          );
          setDraft(draftFrom(null));
          setShowProblems(false);
        },
      }
    );
  }

  // Editing keeps the post's own type (and its own signature in the label).
  const typeChoices = editing ? [editing.postType as StaffNewsPostType] : desk.allowedTypes;
  const signatureName = editing ? (editing.authorName ?? 'Equoria Staff') : desk.signature.name;
  const typeCopy = (t: StaffNewsPostType) => deskTypeCopy(t, signatureName);

  return (
    <form className="news-desk-form" onSubmit={submit} noValidate>
      <fieldset className="news-desk-types" disabled={Boolean(editing)}>
        <legend>What kind of post is this?</legend>
        {typeChoices.map((t) => (
          <label key={t} className="news-desk-type">
            <input
              type="radio"
              name="postType"
              value={t}
              checked={draft.postType === t}
              onChange={() => set({ postType: t })}
            />
            <span>
              <strong>{typeCopy(t).label}</strong>
              <span>{typeCopy(t).hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {draft.postType && (
        <div className="news-desk-fields">
          {draft.postType === 'seasonalEvent' && (
            <FormField
              label="Month"
              required
              error={shown.month}
              description={monthLocked ? 'A published event keeps its month.' : undefined}
            >
              {(p) => (
                <Input
                  {...p}
                  type="month"
                  min={desk.today.slice(0, 7)}
                  value={draft.month}
                  disabled={monthLocked}
                  onChange={(e) => set({ month: e.target.value })}
                />
              )}
            </FormField>
          )}

          <FormField label="Title" required error={shown.title}>
            {(p) => (
              <Input
                {...p}
                value={draft.title}
                maxLength={NEWS_TITLE_MAX}
                onChange={(e) => set({ title: e.target.value })}
              />
            )}
          </FormField>

          <FormField
            label="Words"
            required
            error={shown.body}
            description="A blank line starts a new paragraph."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={8}
                value={draft.body}
                maxLength={NEWS_BODY_MAX}
                onChange={(e) => set({ body: e.target.value })}
              />
            )}
          </FormField>

          {draft.postType === 'contest' && (
            <FormField label="Last day for entries" description="Optional. Shown under Ahead.">
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  min={desk.today}
                  value={draft.closesOn}
                  onChange={(e) => set({ closesOn: e.target.value })}
                />
              )}
            </FormField>
          )}

          {draft.postType === 'seasonalEvent' && (
            <fieldset className="news-desk-tiles">
              <legend>Picture tiles</legend>
              {!desk.imageUploadsReady ? (
                <p className="news-desk-note">
                  Picture storage isn&rsquo;t set up yet, so tiles can&rsquo;t be added. The event
                  can go out without them.
                </p>
              ) : (
                <>
                  {draft.tiles.map((tile, index) => (
                    <div key={tile.key} className="news-desk-tile">
                      {tile.imageUrl && (
                        <img src={tile.imageUrl} alt="" className="news-desk-thumb" />
                      )}
                      <FormField label={`Tile ${index + 1} picture`}>
                        {(p) => (
                          <input
                            {...p}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            disabled={tile.uploading}
                            onChange={(e) => void choosePicture(tile.key, e.target.files?.[0])}
                          />
                        )}
                      </FormField>
                      {tile.uploading && (
                        <p role="status" className="news-desk-note">
                          Uploading the picture&hellip;
                        </p>
                      )}
                      {tile.error && <InlineError message={tile.error} />}
                      <FormField label={`Tile ${index + 1} caption`}>
                        {(p) => (
                          <Input
                            {...p}
                            value={tile.caption}
                            maxLength={NEWS_CAPTION_MAX}
                            onChange={(e) => setTile(tile.key, { caption: e.target.value })}
                          />
                        )}
                      </FormField>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          set({ tiles: draft.tiles.filter((t) => t.key !== tile.key) })
                        }
                      >
                        Remove tile {index + 1}
                      </Button>
                    </div>
                  ))}
                  {draft.tiles.length < NEWS_TILES_MAX && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() =>
                        set({
                          tiles: [
                            ...draft.tiles,
                            {
                              key: nextTileKey(),
                              imageUrl: null,
                              caption: '',
                              uploading: false,
                              error: null,
                            },
                          ],
                        })
                      }
                    >
                      Add a picture tile
                    </Button>
                  )}
                  {shown.tiles && <InlineError message={shown.tiles} />}
                </>
              )}
            </fieldset>
          )}

          {saveError && <InlineError message={actionMessageFor(saveError, deskRefused)} />}
          <div className="news-desk-actions">
            <Button type="submit" pending={saving}>
              {editing
                ? 'Save changes'
                : draft.postType === 'seasonalEvent'
                  ? 'Schedule the event'
                  : 'Post to News'}
            </Button>
            {editing && (
              <Button type="button" variant="secondary" onClick={onCancelEdit} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
