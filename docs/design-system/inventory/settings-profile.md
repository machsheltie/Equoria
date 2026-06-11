# Settings-Profile Family — Post-Migration Completion Record

**Status:** Migrated — **zero matches in the current audit report**
**Pages:** SettingsPage (+ `settings/` sections: Account, Notifications, Display, Sound, DeleteAccountModal, constants), ProfilePage
**Replaces:** the 2026-06-09 pre-migration scan (raw `<input>`s in AccountSection, bespoke `button[role=switch]` Toggle, hand-built delete-account overlay, duplicated layout gutters).

## What is canonical now

- **Containers/headers:** both routed pages use `PageContainer` + `PageHeader`
  (verified by import grep); the duplicated `px-4 sm:px-6 lg:px-8` gutters are
  gone (gutters belong to the shell, DECISIONS §1).
- **Forms:** AccountSection uses `ui/form` `Input`/`PasswordInput`/`FormField`
  (`AccountSection.tsx:24`); ProfilePage uses `ui/form` controls; the settings
  `Toggle` is now a thin row wrapper composing the canonical `Switch`
  primitive (`settings/constants.tsx:12,47`).
- **Dialogs:** `settings/DeleteAccountModal` is on `GameDialog` (the
  hand-built fixed overlay is gone); SettingsPage itself imports GameDialog
  for its confirmation flow.
- **Color:** the family's raw palette accents are tokenized — no
  settings/profile file appears in any audit rule's output.

## Family commit

`e82bb75ba` — settings-profile family migration (Equoria-o5hub.22).

## Remaining known residue

None — no settings-profile file appears in
`node scripts/design-audit/check-design-system.mjs --report` and the family
has no `EXCEPTIONS.md` rows.

## Pointers

DECISIONS §1/§2/§8 (`../DECISIONS.md`) · `../MOTION.md` · `../EXCEPTIONS.md` ·
the audit script above.
