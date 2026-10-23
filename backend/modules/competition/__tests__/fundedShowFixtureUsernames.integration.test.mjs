/**
 * The funded-show fixture keeps the whole unique tag in every username
 * (Equoria-63ifs).
 *
 * makeUser built `(prefix-role-tag).slice(0, 30)`. With a prefix such as
 * 'TestFixture-cmw851' only about three hex characters of the tag survived, so a
 * twelve-entrant settlement suite had roughly a 1.5 percent chance of a unique
 * username collision. The unique part must be what survives the 30-character cut.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { createFundedShowFixtures } from './helpers/fundedShowFixtures.mjs';

const fx = createFundedShowFixtures('TestFixture-cmw851');

afterAll(() => fx.cleanup(), 60000);

describe('funded show fixture usernames (Equoria-63ifs)', () => {
  it('ends every username with the complete unique tag, within the 30-character limit', async () => {
    const users = await Promise.all([fx.makeUser(0, 'entrant'), fx.makeUser(0, 'entrant'), fx.makeUser(0, 'creator')]);

    for (const user of users) {
      const tag = /-([0-9a-f]{10})@test\.local$/.exec(user.email)?.[1];
      expect(tag).toBeDefined();
      expect(user.username.length).toBeLessThanOrEqual(30);
      expect(user.username.endsWith(tag)).toBe(true);
      expect(user.username.startsWith('TestFixture-')).toBe(true);
    }
    expect(new Set(users.map(u => u.username)).size).toBe(3);
  }, 30000);
});
