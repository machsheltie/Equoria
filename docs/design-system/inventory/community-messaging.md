# Community-Messaging Family — Post-Migration Completion Record

**Status:** Migrated
**Pages:** CommunityPage, ClubsPage (+ `clubs/`), MessageBoardPage, MessageThreadPage, MessagesPage (+ `messages/`)
**Replaces:** the 2026-06-09 pre-migration scan (manual `role="tab"` button-rows on every page, two competing form-field recipes, three divergent modal implementations, 20+ raw command buttons).

## What is canonical now

- **Containers/headers:** all five routed pages use `PageContainer` +
  `PageHeader` (verified by import grep).
- **Tabs:** the identical hand-rolled `bg-white/5` tab rows are gone —
  Clubs, MessageBoard, and Messages (inbox/notifications) use `CanonicalTabs`.
- **Dialogs:** the three divergent modal idioms (bare overlay in
  MessageBoardPage, bespoke `ComposeModal` overlay, `z-50`
  TransferLeadershipModal) are unified on `GameDialog` — verified consumers:
  `MessageBoardPage`, `messages/ComposeModal`, `clubs/TransferLeadershipModal`.
- **Forms:** compose/post fields use `ui/form/*`, collapsing the two
  competing field recipes into the single `fieldStyles.ts` appearance.
- **Color:** unread badges and role accents use status/badge tokens
  (`text-role-*`, `--badge-*-bg`) instead of `bg-red-500/80` vs
  `bg-blue-500/80` raw palette.

## Family commit

`f08d662b7` — community-messaging family migration (Equoria-o5hub.19).

## Remaining known residue (baseline-tracked)

- `pages/MessageThreadPage.tsx:135` — `max-w-[200px]` on a breadcrumb
  truncation `<span>`. Flagged by the `outer-width-wrapper` regex but it is a
  text-truncation width, not a page wrapper; held in the ratchet baseline
  rather than excepted.

No other community-messaging file appears in the audit report.

## Pointers

DECISIONS §1/§2/§6/§8 (`../DECISIONS.md`) · `../MOTION.md` ·
`../EXCEPTIONS.md` ·
`node scripts/design-audit/check-design-system.mjs --report`
