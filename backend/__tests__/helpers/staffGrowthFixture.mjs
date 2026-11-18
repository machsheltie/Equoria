/**
 * A test-owned growth profile for a rider or groom (Equoria-xlw03, owner ruling q331).
 *
 * Every rider and groom carries hidden growth items that act: a rider's add or take
 * flat points on its horse's show score, a groom's add or take bond per grooming. A
 * staff member with no profile gets one drawn at random the first time a show or a
 * grooming reads it (`ensureGrowthProfileTx`), so a fixture that leaves it to that draw
 * gets a random score or bond. A test that is not about those items gives its staff an
 * empty profile here, so nothing random can reach what it asserts; a test about them
 * passes the items it means.
 *
 *   await giveStaffGrowthProfile(prisma, 'groom', groom.id); // no items: no effect
 *
 * The profile row cascades with its rider or groom, so it needs no cleanup of its own.
 */

const profileTables = Object.freeze({
  rider: Object.freeze({ table: 'riderGrowthProfile', key: 'riderId' }),
  groom: Object.freeze({ table: 'groomGrowthProfile', key: 'groomId' }),
});

/**
 * @param {object} db - prisma client
 * @param {'rider'|'groom'} staffType
 * @param {number} staffId
 * @param {Array<{ kind: string, value: string|number, sign: string, revealed: boolean }>} [items]
 * @returns {Promise<object>} the profile row
 */
export async function giveStaffGrowthProfile(db, staffType, staffId, items = []) {
  const tables = profileTables[staffType];
  if (!tables) {
    throw new Error(`Staff type has no growth profile: ${String(staffType)}`);
  }
  return db[tables.table].create({ data: { [tables.key]: staffId, items } });
}
