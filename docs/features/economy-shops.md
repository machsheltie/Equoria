# Economy Shops Contract

**Status:** Active contract
**Owner:** Project owner
**Last verified:** 2026-10-23
**Load only when:** changing or reviewing the Bank, the feed, tack, vet or farrier shops, crafting, the player inventory, the coin ledger, or how tack scores in a show
**Do not load for:** horse purchases and sales, stud fees, show entry fees or prizes, grooming, training, or visual design of the shop pages
**Live sources:** `backend/modules/bank/`, `backend/modules/economy/`, `backend/modules/crafting/`, `backend/modules/competition/rules/tackScoring.mjs`, `backend/modules/auth/constants/authConstants.mjs`, `packages/database/prisma/schema.prisma` (`UserTransaction`, `SystemAccount`), and the tests beside each module
**Retire when:** the owner replaces the shop economy, or every rule below is enforced by a named executable test

This contract records what the shops do today and the owner rulings that bind
them. It was written from the shipped code on 2026-10-23 (Equoria-oey96.36), so
it describes the game as it runs. Where the code and a ruling disagree, the
disagreement is listed under "Shipped gaps" instead of being smoothed over. It
holds rules, not catalogs: prices, tier tables, service lists and recipe lists
live in the constants named under "Live implementation map", and a copy here
would only drift. The feed tiers, daily feeding, health bands and pregnancy
formula belong to [`feed-system.md`](feed-system.md).

`PRODUCT.md` and `DESIGN.md` govern how any of this is presented. Nothing here
is a layout, a page structure or a copy deck.

## Owner rulings that bind every shop

- A new account starts with 10,000 gameplay coins. The Bank's weekly claim is
  5,000 coins (`PRODUCT.md`, "Economy and show rulings").
- There is no system conception fee, listing fee, sale commission or stud-fee
  house cut. Shops are the only places coin leaves the game.
- Meaningful horse work stays player-performed: there is no batch feeding,
  grooming, shoeing, veterinary care or tack buying. Each purchase names one
  horse (or none, for the pooled feed and materials) and happens one request at
  a time.
- Tack in a show (owner rulings 2026-10-23, epic Equoria-k1p62): only a saddle
  and a bridle score, one of each per horse; a discipline saddle or bridle adds
  5 points in its own discipline and nothing in any other; an All Purpose
  saddle or bridle adds 2 in any discipline; the points are flat, not
  percentages, so tack adds at most 10. Decorations never score in a discipline
  show; they only lift the presentation part of a parade score. Traits add
  nothing to a show score.
- Players never see a per-result score breakdown, so no shop screen may promise
  one.

## Rules every spend obeys

- A spend is one database transaction. The coin debit is a guarded conditional
  update (the balance must cover the price at write time), so two requests in
  flight can never take a wallet negative. A shortfall answers 400 and changes
  nothing.
- Every debit is paired with a credit to a system account (`burn` for shops), so
  the sum of player money plus system balances is constant across a spend. An
  unpaired player debit is not expressible through the helper.
- Each spend writes the player's ledger row (`debit`, with a category such as
  `feedPurchase`, `tackPurchase`, `vetService`, `farrierService`, `crafting`,
  a description and metadata naming the horse or item) and the paired system
  credit row (the same category with a `Burn` suffix, linked to the player).
  The player reads the ledger from the Bank, newest first, paged.
- A horse named in a request must belong to the caller. A horse that is
  someone else's and a horse that does not exist answer the same 404.
- Spending routes run behind authentication, the financial rate limiter and
  the request validators. A transaction timeout surfaces as a retryable 503, not
  a 500.
- Pooled goods (feed units, crafted items, unattached tack, crafting
  materials) live in the player's `User.settings` document and are changed by
  path-scoped updates inside the same transaction as the coin debit.

## Bank

- The weekly claim credits the caller once per game week. The week turns over
  at 00:00 Eastern on Sunday, the game clock, never UTC. A missed week does not
  roll over.
- The claim is atomic: one conditional update both checks "not yet claimed this
  week" and adds the coins, so a double-submit pays once. The credit has a
  `weeklyReward` ledger row. It is the only coin faucet among these systems and
  has no system-account counterpart.
- A claim-status read says whether the claim is open and, when it is not, when
  it reopens. The Bank also serves the transaction ledger described above,
  including at its older path under the users prefix.

## Feed shop

- Feed is sold in packs of 100 units per tier into one pooled inventory entry
  per tier. Buying feed feeds no horse; equipping and feeding are separate
  player actions owned by `feed-system.md`.
- A purchase must name a catalog tier and a whole number of packs of at least
  one. An unknown tier is 404; a bad pack count is 400.

## Tack shop, inventory and tack in shows

- Tack is bought for one named horse and goes straight onto it: a saddle,
  bridle, halter, saddle pad, leg wraps, reins, girth or breastplate replaces
  whatever occupied that slot, and a decoration is added to the horse's
  decoration list (the same decoration is never added twice).
- The inventory holds what the player owns but has not put on a horse: the
  starter saddle and bridle every account begins with, crafted items, and tack
  handed back to a seller when a horse is sold (shop-bought decorations
  included). Equipping moves an item onto one horse's slot; unequipping or
  removing a decoration returns it to the inventory instead of destroying it.
  An item is on at most one horse at a time.
- Show scoring reads the item standing in the saddle and bridle slots and that
  item's own discipline list: empty means All Purpose. A crafted saddle or
  bridle whose discipline is ambiguous is classed All Purpose until the owner
  classifies it. The numbers stored beside the ids on the horse
  (`saddleBonus`, `bridleBonus`) are a purchase-time mirror and are not read by
  the scorer.

## Vet

- The vet sells fixed one-horse services. Every service records the visit date
  on the horse (the game calendar date). Some also set the horse's stated health
  finding; the others change only the visit date.
- Displayed health is the worse of feed health and vet health, and critical
  displayed health blocks breeding and show entry (`feed-system.md`). A vet
  visit does not erase neglect, and feeding does not erase a vet problem.

## Farrier

- The farrier sells fixed one-horse services that set the horse's hoof
  condition and farrier date; the shoeing services also set the last-shod date.
- A nightly job (03:45 on the game clock) steps hoof condition down one level per elapsed decay
  interval since the last farrier visit, never up, so a booked service is never
  undone early and a horse never visited is left alone. The interval is
  configurable and falls back to a default in the decay service.
- Hoof condition is a prompt to rebook. Nothing in show scoring or the
  breeding and entry health gates reads it today.

## Crafting

- The Leathersmith Workshop turns crafting materials plus coins into a tack
  item. A recipe names a minimum workshop tier, a coin cost, a material list and
  the item it yields. The craft fails with 403 below the tier, 400 on a material
  or coin shortfall, and 404 for an unknown recipe.
- A craft is one transaction: the coin debit (paired with the `burn` account,
  category `craftingFeeBurn`), the material deduction recomputed from the locked
  row, the new inventory item and the ledger row commit together or not at all.
  Two simultaneous crafts cannot spend the same materials.
- Crafted saddles and bridles carry a discipline list in their recipe and score
  by the tack rules above. Crafted halters, blankets and cosmetics score nothing.

## Shipped gaps

These are facts about the code today, not promises. Fixing any of them is an
owner decision and a fresh issue.

- **Crafting is a starter-kit sink.** Materials are granted once at registration
  (and by a backfill script for older accounts), and every account begins at
  workshop tier 0. No shipped route grants more materials or raises the
  workshop tier, so tier 1 to 3 recipes cannot be unlocked by play.
- **Shop bonus text drifts from scoring.** The tack catalog still carries a
  per-item `bonus` string and `numericBonus` (for example a different number on
  racing and figure-eight tack, and non-zero numbers on halters, pads, wraps,
  reins, girths and breastplates). Ridden scoring ignores them; only the saddle
  and bridle slots score, at 5 or 2. A player reading the shop can be promised a
  bonus she will not receive.
- **Hoof condition has no gameplay consequence** beyond prompting the next
  farrier booking.

## Live implementation map

- Bank and weekly claim: `backend/modules/bank/`
- Coin helpers, system accounts, ledger writes and reads, player-to-player
  transfer: `backend/modules/economy/services/`
- Feed catalog and purchase: `backend/modules/economy/feedShop/`
- Tack catalog, purchase and decoration removal: `backend/modules/economy/tackShop/`
- Inventory equip and unequip: `backend/modules/economy/inventory/`
- Vet services: `backend/modules/economy/vet/`; farrier services:
  `backend/modules/economy/farrier/`; hoof decay:
  `backend/modules/horses/services/hoofConditionDecayService.mjs` and its job
  under `backend/services/jobs/`
- Crafting recipes and craft: `backend/modules/crafting/`
- Tack points in a show: `backend/modules/competition/rules/tackScoring.mjs`
- Starter money, starter tack and starter materials:
  `backend/modules/auth/constants/authConstants.mjs`
- Route mounting: `backend/app/routers.mjs`
- Concurrency and ledger tests sit in each module's `__tests__/` directory;
  read them before changing a spend.
