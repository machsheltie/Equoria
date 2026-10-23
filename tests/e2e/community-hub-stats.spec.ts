/**
 * Community hub stats — real election badge and real numbers (Equoria-m00gp,
 * from Equoria-r4cyk).
 *
 * r4cyk replaced the hub's stub literals: every stat is backed by a real query
 * and rendered four-state, and the Clubs card's "Elections open" badge is gated
 * on real election state (GET /api/v1/clubs/elections/open-count). This spec
 * proves both from a player's seat against the real backend:
 *   1. a player whose club has a genuinely open election sees the badge;
 *   2. a player in no club does not;
 *   3. no stat is left as a permanent loading placeholder, and the club counts
 *      shown are the counts in the real GET /api/v1/clubs payload.
 *
 * Each player is registered and onboarded over the real API
 * (fixtures/seededPlayer.ts). The club and its election are created through the
 * real club routes (POST /clubs makes the creator its president; a president
 * may open an election). No route deletes a club, so fixtures/clubs.ts removes
 * exactly that club afterwards. No route interception, no bypass headers.
 */
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { csrfMutate } from './helpers/api';
import { createSeededPlayerSession, type SeededPlayerSession } from './fixtures/seededPlayer';
import { removeClub } from './fixtures/clubs';

type ClubMember = { player: SeededPlayerSession; clubId: number };

const test = base.extend<object, { member: ClubMember; outsider: SeededPlayerSession }>({
  member: [
    async ({ browser }, use) => {
      const player = await createSeededPlayerSession(browser);
      let clubId: number | undefined;
      try {
        const clubRes = await csrfMutate(player, 'POST', '/api/v1/clubs', {
          name: `E2E Hub Club ${player.username}`.slice(0, 100),
          type: 'discipline',
          category: 'Dressage',
          description: 'A club created by the community hub stats spec.',
        });
        expect(clubRes.status(), `POST /api/v1/clubs returned ${await clubRes.text()}`).toBe(201);
        const clubJson = (await clubRes.json()) as { data?: { club?: { id?: unknown } } };
        const createdId = clubJson.data?.club?.id;
        expect(
          Number.isInteger(createdId) && (createdId as number) > 0,
          `club create must return a positive integer id, got ${JSON.stringify(createdId)}`
        ).toBe(true);
        clubId = createdId as number;

        // Started a minute ago, so the route records it as open, not upcoming.
        const now = Date.now();
        const electionRes = await csrfMutate(player, 'POST', `/api/v1/clubs/${clubId}/elections`, {
          position: 'president',
          startsAt: new Date(now - 60_000).toISOString(),
          endsAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
        expect(
          electionRes.status(),
          `POST /api/v1/clubs/${clubId}/elections returned ${await electionRes.text()}`
        ).toBe(201);
        const electionJson = (await electionRes.json()) as {
          data?: { election?: { status?: string } };
        };
        expect(electionJson.data?.election?.status).toBe('open');

        await use({ player, clubId });
      } finally {
        try {
          if (clubId !== undefined) {
            await removeClub(clubId);
          }
        } finally {
          await player.context.close();
        }
      }
    },
    { scope: 'worker' },
  ],
  outsider: [
    async ({ browser }, use) => {
      const player = await createSeededPlayerSession(browser);
      await use(player);
      await player.context.close();
    },
    { scope: 'worker' },
  ],
});

type ClubsPayload = { data?: { clubs?: Array<{ type: string }> } };

/** Open /community as `player`; returns the page and the real clubs payload it read. */
async function openHub(player: SeededPlayerSession): Promise<{ page: Page; clubs: ClubsPayload }> {
  const page = await player.context.newPage();
  const clubsRes = page.waitForResponse(
    (resp) =>
      new URL(resp.url()).pathname === '/api/v1/clubs' &&
      resp.request().method() === 'GET' &&
      resp.status() === 200,
    { timeout: 30000 }
  );
  const electionsRes = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/v1/clubs/elections/open-count') &&
      resp.request().method() === 'GET' &&
      resp.status() === 200,
    { timeout: 30000 }
  );
  await page.goto('/community', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Community' }).first()).toBeVisible({
    timeout: 20000,
  });
  const clubs = (await (await clubsRes).json()) as ClubsPayload;
  await electionsRes;
  return { page, clubs };
}

/** The value rendered above a stat label inside a hub card. */
function statValue(card: Locator, label: string): Locator {
  return card.getByText(label, { exact: true }).locator('xpath=preceding-sibling::div[1]');
}

async function expectRealClubCounts(page: Page, clubs: ClubsPayload): Promise<void> {
  const rows = clubs.data?.clubs ?? [];
  const discipline = rows.filter((c) => c.type === 'discipline').length;
  const breed = rows.filter((c) => c.type === 'breed').length;
  const card = page.getByTestId('community-card-clubs');
  await expect(statValue(card, 'Discipline clubs')).toHaveText(String(discipline));
  await expect(statValue(card, 'Breed clubs')).toHaveText(String(breed));
}

async function expectNoPendingStats(page: Page): Promise<void> {
  // Every card stat settles: no loading placeholder (role="status") remains
  // and none of them is the error marker.
  const cards = page.locator('[data-testid^="community-card-"]');
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  await expect(cards.locator('[role="status"]')).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByTestId('community-stats-error')).toHaveCount(0);
  for (const label of ['Active threads', 'Unread', 'Conversations', 'Inductees', 'Total wins']) {
    await expect(statValue(page.locator('body'), label)).toHaveText(/^\d+$/);
  }
}

test.describe('Community hub stats (Equoria-m00gp)', () => {
  test('a player whose club has an open election sees the Elections open badge', async ({
    member,
  }) => {
    const { page, clubs } = await openHub(member.player);
    try {
      const clubsCard = page.getByTestId('community-card-clubs');
      await expect(clubsCard.getByText('Elections open', { exact: true })).toBeVisible({
        timeout: 15000,
      });
      await expectNoPendingStats(page);
      await expectRealClubCounts(page, clubs);
    } finally {
      await page.close();
    }
  });

  test('a player in no club sees no badge, and every stat is a real number', async ({
    outsider,
  }) => {
    const { page, clubs } = await openHub(outsider);
    try {
      await expectNoPendingStats(page);
      await expectRealClubCounts(page, clubs);
      await expect(
        page.getByTestId('community-card-clubs').getByText('Elections open', { exact: true })
      ).toHaveCount(0);
    } finally {
      await page.close();
    }
  });
});
