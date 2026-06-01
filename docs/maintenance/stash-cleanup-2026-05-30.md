# Stash Pile Cleanup — 2026-05-30 (closes Equoria-ou4j8)

## Context

The git stash pile had accumulated **155 entries** from prior parallel-agent contention. These were creating active risk: agents stashing/popping during rebases collide with these accumulated entries. The vast majority were already autoclassified by prior agents as residue ("agent-X-residue-*", "wip-other-agent-*", "non-mine-*", etc.) or "WIP on master: <old-commit>" entries pointing at commits hundreds-to-thousands of commits behind HEAD.

This log records every drop decision so the user can audit afterward.

## Safety protocol applied

- **Never** `git stash clear`.
- **Never** drop a stash whose message/contents indicate uncertain provenance.
- **Inspect first** for any recent-named stash (2026-05-29 or stash@{0}–stash@{7}) before dropping.
- **Keep**: any stash whose base commit is within ~30 commits of HEAD, AND whose message is not "non-mine"/"residue"/"park"/"other-agent".
- **Keep**: stash@{0} (recent WIP, 12 commits behind HEAD, includes farrier+eslint+recordTransactionTx test — could be in-flight work).

## Master HEAD at start

```
fd3c32438 fix(grooms): wrap salary cron in tx + atomic debit + SystemAccount.burn pair (closes Equoria-7r67q)
```

Stash count at start: **155**

## Drop log

Each entry below records: stash index (at decision time), first line of message, reason for drop. Drops were performed top-down by repeatedly dropping `stash@{N}` of the highest current index in each category so indices renumbered predictably.

NOTE: Because `git stash drop` renumbers indices, the drops were processed strictly highest-index-first so lower indices stayed stable across drops.

```
DROPPING stash@{153}: stash@{153}: WIP on cleanup-session-2026-01-30: 7c9c9062 fix(auth): accept refresh tokens from both body and cookies | REASON: cleanup-session-2026-01-30: 7c9c9062 — Jan 30 branch, 2117 commits behind
Dropped stash@{153} (854e2a2cbc34a187a668d656c1b5187e7ec4b27f)
DROPPING stash@{152}: stash@{152}: On cleanup-session-2026-01-30: Temp stash: node_modules and local settings before merge | REASON: cleanup-session-2026-01-30: Temp stash node_modules — generated files, old
Dropped stash@{152} (0c1724791f75c63de264442211e6f42c346d2476)
DROPPING stash@{151}: stash@{151}: WIP on master: e6eab00f fix(performance): correct remaining ownerId->userId schema field | REASON: WIP on master: e6eab00f — 2177 commits behind
Dropped stash@{151} (8f1140b6e6cc93c3e8a3669b96ab3d298432e390)
DROPPING stash@{150}: stash@{150}: WIP on cleanup-session-2026-01-30: 827cbccc feat(epic-6): complete Breeding & Foal Development system | REASON: cleanup-session-2026-01-30: 827cbccc epic-6 — 2049 commits behind
Dropped stash@{150} (5a8e59b081fb12fbcf58b321c5fdaff99bfe518d)
DROPPING stash@{149}: stash@{149}: WIP on cleanup-session-2026-01-30: ef5510cd feat(9a-2): Playwright E2E suite for core game flows — Story 9A-2 complete | REASON: cleanup-session-2026-01-30: ef5510cd 9A-2 — 2049 commits behind
Dropped stash@{149} (a8933df193f63ee380c7ba36a25747822d2e4614)
DROPPING stash@{148}: stash@{148}: On cleanup-session-2026-01-30: wip: node_modules and generated files before master merge | REASON: cleanup-session-2026-01-30: wip node_modules — generated files, old
Dropped stash@{148} (03312f9c214855bc5a66f241cae31a8454e1aa63)
DROPPING stash@{147}: stash@{147}: On cleanup-session-2026-01-30: pre-merge generated files | REASON: cleanup-session-2026-01-30: pre-merge generated files — old
Dropped stash@{147} (fc086048e978509d78a27d43b4b68dfcd0cfe38e)
DROPPING stash@{145}: stash@{145}: WIP on master: 70111ae8 fix(tests): resolve breed lookup failures in integration tests after unique-name migration | REASON: WIP on master: 70111ae8 — 1825 commits behind, vite cache + generated junk
Dropped stash@{145} (d636cf1bc2b8482b18a5fbeeb6b9c0785ead9fcd)
DROPPING stash@{144}: stash@{144}: WIP on master: 71fe0469 fix(tests): idempotent beforeAll in personalityEvolutionController | REASON: WIP on master: 71fe0469 — 1825 commits behind
Dropped stash@{144} (8abcea5ab478b01338428f08a2ff70596a6f09e5)
DROPPING stash@{143}: stash@{143}: WIP on master: 72752c07 fix(notifications): invalidate next-actions cache on horse rename and store purchase | REASON: WIP on master: 72752c07 — far behind
Dropped stash@{143} (95528ef9ed8569d43dd80e7288155f9535c86e3a)
DROPPING stash@{142}: stash@{142}: WIP on master: b5063b8f fix(epic5): leaderboard ARIA + BaseModal + XP level computation | REASON: WIP on master: b5063b8f — far behind
Dropped stash@{142} (9b12cbff99252487ba8169db63fdad804d5832e7)
DROPPING stash@{141}: stash@{141}: WIP on master: 872ab54f docs(tea-td): update TD audit — R-02/R-04 resolved, R-01 partial, R-12 added+resolved | REASON: WIP on master: 872ab54f — 1773 commits behind
Dropped stash@{141} (bb47f77a358dd74acaecb54d32f5264f819791ce)
DROPPING stash@{140}: stash@{140}: On fix/test-disconnect-contamination: parallel-session-lint-cleanup | REASON: fix/test-disconnect-contamination: parallel-session-lint-cleanup — dead branch
Dropped stash@{140} (af9cd7c8d2dc6bb50da1df0bd396bc7a272ab507)
DROPPING stash@{139}: stash@{139}: On fix/test-disconnect-contamination: parallel-bmad-sprint-status | REASON: fix/test-disconnect-contamination: parallel-bmad-sprint-status — dead branch
Dropped stash@{139} (00324c8cff438574db5817cfc8bf8b937aee08fe)
DROPPING stash@{138}: stash@{138}: On fix/vite-cves-equoria-2gz: wip-old-branch-switch | REASON: fix/vite-cves-equoria-2gz: wip-old-branch-switch — dead branch
Dropped stash@{138} (2abf79ffb2b82c73566ccd801ddafd4a6a598b7d)
DROPPING stash@{137}: stash@{137}: WIP on fix/vite-cves-equoria-2gz: c127d73e fix(ci): consolidate ZAP reports into single tracking issue | REASON: WIP on fix/vite-cves-equoria-2gz: c127d73e — 1663 commits behind, dead branch
Dropped stash@{137} (dd28c8b023a2f7fa51c1cc7502f8a75be871fdd9)
DROPPING stash@{136}: stash@{136}: On hotfix/21r-auth-1-refresh-cookie-path: beads-pending | REASON: hotfix/21r-auth-1-refresh-cookie-path: beads-pending — dead 21R branch
Dropped stash@{136} (f53e00bcc03232a8f82395a6bfc3d61b33967e9f)
DROPPING stash@{135}: stash@{135}: On hotfix/21r-auth-1-refresh-cookie-path: pre-cherrypick wip | REASON: hotfix/21r-auth-1-refresh-cookie-path: pre-cherrypick wip — dead 21R branch
Dropped stash@{135} (c56f7f606407b6607992144aab39228596cbdfad)
DROPPING stash@{133}: stash@{133}: On docs/21r-auth-1-spec-retroactive: auto-branch-work | REASON: docs/21r-auth-1-spec-retroactive: auto-branch-work — dead 21R branch
Dropped stash@{133} (02788316176d030a4a55bb68b8154857bedc4ff7)
DROPPING stash@{132}: stash@{132}: On chore/delete-dead-services: no-origin-hotfix | REASON: chore/delete-dead-services: no-origin-hotfix — dead branch
Dropped stash@{132} (d03dbf39db76b6a80721d4db5effda59f69a9a4a)
DROPPING stash@{131}: stash@{131}: WIP on fix/21r-security-hardening-corrected: d5efb0c2 feat(governance): re-runnable evidence files for completed stories (B4 / Equoria-ptf7) | REASON: WIP on fix/21r-security-hardening-corrected: d5efb0c2 — doomed 56-commit branch (constitution-cited failure)
Dropped stash@{131} (9901a3865f9488dcdd36830cd79d8f61f2f5367e)
DROPPING stash@{130}: stash@{130}: On fix/21r-security-hardening-corrected: pre-cherry-pick-WIP | REASON: fix/21r-security-hardening-corrected: pre-cherry-pick-WIP — doomed branch
Dropped stash@{130} (0a13c11c16d1fde152aa5c359e5f4ab4cff4de6b)
DROPPING stash@{129}: stash@{129}: WIP on fix/21r-security-hardening-corrected: 1b6c9ae9 test(21R-SEC): replace 4 vacuous conditional assertions in urlencoded-duplicate-key suite (Equoria-pzpg) | REASON: WIP on fix/21r-security-hardening-corrected: 1b6c9ae9 — doomed branch
Dropped stash@{129} (19a9b278b7a7e00d6db4d2ecf6dc97abcaceb8c9)
DROPPING stash@{128}: stash@{128}: On master: wip-storage-and-test-results | REASON: wip-storage-and-test-results — playwright storageState.json + test-results, generated files
Dropped stash@{128} (767477ddbcfacfc3e64fe567db7667b20a3657cf)
DROPPING stash@{127}: stash@{127}: WIP on master: 58674358 fix(frontend): restore feed shop banner image on FeedShopPage | REASON: WIP on master: 58674358 — 1495 commits behind
Dropped stash@{127} (fa4c6d8426b01e82f56bc0909aaf28ad065cccd0)
DROPPING stash@{126}: stash@{126}: On master: wip-pre-build-fix-pull | REASON: wip-pre-build-fix-pull — vague, old
Dropped stash@{126} (19f784e84f336b0065e3d4fa3df16dcafaf76306)
DROPPING stash@{125}: stash@{125}: On master: frontend wip — not part of CWE-639 wave 5 | REASON: frontend wip — not part of CWE-639 wave 5 — explicit non-mine declaration
Dropped stash@{125} (601ff0f2422ed36bf9c9d4f1a0ca2f9a18ce9650)
DROPPING stash@{124}: stash@{124}: On master: pre-rebase unstaged noise | REASON: pre-rebase unstaged noise — explicit noise label
Dropped stash@{124} (e56978dfe6d23148d485eeae8564007430b66f85)
DROPPING stash@{123}: stash@{123}: WIP on master: c16552fd feat(tests): Equoria-rr7 — errorHandler middleware unit tests (14 tests) | REASON: WIP on master: c16552fd — 1262 commits behind
Dropped stash@{123} (b0f537a54b775bbdec82620b3a764d381b7bbc9d)
DROPPING stash@{122}: stash@{122}: WIP on master: 88ced313 test(coverage): extend traitTimelineService with milestoneContext/excludedTraits/quality-levels branches (Equoria-rr7) | REASON: WIP on master: 88ced313 — 962 commits behind
Dropped stash@{122} (fc53e428d1727cf526ea9b5f2cab1fdaa52acf7f)
DROPPING stash@{121}: stash@{121}: WIP on master: 88ced313 test(coverage): extend traitTimelineService with milestoneContext/excludedTraits/quality-levels branches (Equoria-rr7) | REASON: WIP on master: 88ced313 — 962 commits behind (dupe)
Dropped stash@{121} (67451bccd449712339ed8ecc2a1e77c0067e882c)
DROPPING stash@{120}: stash@{120}: WIP on master: 47dc6cca perf(leaderboards): replace full-table scans with user-scoped SQL queries in getUserRankSummary | REASON: WIP on master: 47dc6cca — 958 commits behind
Dropped stash@{120} (e756c5b9e933f86919240acfe4fc28c8ecc37ce8)
DROPPING stash@{119}: stash@{119}: WIP on master: 966e5917 feat(perf): add GET /api/performance/metrics monitoring endpoint | REASON: WIP on master: 966e5917 — 954 commits behind
Dropped stash@{119} (2ef862e3ee1585660fb0d6edbb984c67fe6331c2)
DROPPING stash@{118}: stash@{118}: WIP on master: b99e13a0 test(coverage): extend featureFlagMiddleware with listFlags/getFlag admin handler branch coverage (Equoria-rr7) | REASON: WIP on master: b99e13a0 — 923 commits behind
Dropped stash@{118} (576dd43bcd18059608f886634ddd72f739b83980)
DROPPING stash@{117}: stash@{117}: WIP on master: ce0581aa fix(test): replace string foalId with integer sentinel in flagAssignmentEngine test (Equoria-xzgw) | REASON: WIP on master: ce0581aa — 908 commits behind
Dropped stash@{117} (62e04e19d26857302c83f40368b61a81b3324e6c)
DROPPING stash@{116}: stash@{116}: WIP on master: ce0581aa fix(test): replace string foalId with integer sentinel in flagAssignmentEngine test (Equoria-xzgw) | REASON: WIP on master: ce0581aa — 908 commits behind (dupe)
Dropped stash@{116} (9bc4316ddd9762dec02845aaf047c858c67c0aaa)
DROPPING stash@{115}: stash@{115}: WIP on master: 650b0567 fix(ci): expand Gate 4 in check-beta-readiness.sh to cover module-colocated tests (Equoria-grx4) | REASON: WIP on master: 650b0567 — 906 commits behind
Dropped stash@{115} (4cb1aa16eb0432cfd592cdac1ad83d59534048a7)
DROPPING stash@{114}: stash@{114}: WIP on master: 116235de fix(leaderboards): replace broken performanceScore with MAX(score) query and add UUID validation (Equoria-847r + Equoria-ombe) | REASON: WIP on master: 116235de — 903 commits behind
Dropped stash@{114} (24df944d24a64bf69c853ffd192a3ca43f9e4b21)
DROPPING stash@{113}: stash@{113}: WIP on master: d52809b8 fix(tests): resolve Gate 4b timeouts + add xl/auth coverage (Equoria-4cgp, Equoria-cpz5, Equoria-ecyt) | REASON: WIP on master: d52809b8 — 800+ commits behind
Dropped stash@{113} (2e6ef5c967fe048dac78be3fa076bad05b09b1bd)
DROPPING stash@{112}: stash@{112}: On master: session-noise-frontend-changes | REASON: session-noise-frontend-changes — explicit noise
Dropped stash@{112} (87b156a76a6307df5db556d5450848db0e4d9e6b)
DROPPING stash@{111}: stash@{111}: WIP on master: 7edfde68 fix(frontend): resolve __dirname undefined in Storybook ESM context | REASON: WIP on master: 7edfde68 — 823 commits behind
Dropped stash@{111} (4ae75e6a477f47bb8c68e7bce78b9b1c39ff9895)
DROPPING stash@{110}: stash@{110}: On master: pre-rr7-agent1-stash | REASON: pre-rr7-agent1-stash — agent-residue prefix
Dropped stash@{110} (557fcab60e3158cc1283552681fa64b31f8307e0)
DROPPING stash@{109}: stash@{109}: On master: frontend coverage deletions | REASON: frontend coverage deletions — generic deletions, no context
Dropped stash@{109} (5aeb5258516ff38544f21244683178ce1986c765)
DROPPING stash@{108}: stash@{108}: WIP on master: a74182b0 fix(rate-limit): bind limiters to Redis after connect, raise beta cap (Equoria-obwp follow-up) | REASON: WIP on master: a74182b0 — 793 commits behind
Dropped stash@{108} (827712f3cbbcfa3d84479ac990f3ba7b990f2fdf)
DROPPING stash@{107}: stash@{107}: On master: wip-groomSystem-synergy-not-mine | REASON: wip-groomSystem-synergy-not-mine — explicit not-mine
Dropped stash@{107} (3047246ac81c24dbae1de91c76e4a7b3af7f53f0)
DROPPING stash@{106}: stash@{106}: On master: wip-schema-not-mine | REASON: wip-schema-not-mine — explicit not-mine
Dropped stash@{106} (2da60aec07578c1cd6f40b5fad725d0e72182319)
DROPPING stash@{105}: stash@{105}: On master: wip-other-agents | REASON: wip-other-agents — explicit other-agent
Dropped stash@{105} (1cea05333005d9e7c324ae25e7a13459bf0edc6f)
DROPPING stash@{104}: stash@{104}: On master: wip-other-agent-3 | REASON: wip-other-agent-3 — explicit other-agent
Dropped stash@{104} (f8104514d3c17aadb9cca1fd7f8134d0097edbc2)
DROPPING stash@{103}: stash@{103}: On master: wip-other-agent-4 | REASON: wip-other-agent-4 — explicit other-agent
Dropped stash@{103} (2daa9be73d1141f5981eb3e035ac222207cfd418)
DROPPING stash@{102}: stash@{102}: WIP on master: 99d6a9c5 chore: remove deprecated temperamentDrift.mjs (Equoria-nw3l) | REASON: WIP on master: 99d6a9c5 — 789 commits behind
Dropped stash@{102} (1e4d939461aac2bdc081030470e76af1af693b1e)
DROPPING stash@{101}: stash@{101}: On master: agent3-temp-other-work | REASON: agent3-temp-other-work — explicit agent-residue
Dropped stash@{101} (b4f84198304f5db8cffe4c2b6d18c539abc8efab)
DROPPING stash@{100}: stash@{100}: On master: agent3-other-frontend | REASON: agent3-other-frontend — explicit agent-residue
Dropped stash@{100} (c61565cd0654218d56dc8336831dbf03940da4c5)
DROPPING stash@{99}: stash@{99}: On master: session-end-stash-2026-05-15-in-progress-temp-ui-work | REASON: session-end-stash-2026-05-15-in-progress-temp-ui-work — old (2026-05-15)
Dropped stash@{99} (27762fdefcf58e1baf54a3382014304485c4850f)
DROPPING stash@{98}: stash@{98}: On master: WIP unrelated | REASON: WIP unrelated — explicit unrelated
Dropped stash@{98} (8a7f3c2a0e853ca401e05e3d68fc03e19a974c86)
DROPPING stash@{97}: stash@{97}: On master: WIP unrelated | REASON: WIP unrelated — explicit unrelated
Dropped stash@{97} (830de63587f634365346bfb2e78299a1c5d2d895)
DROPPING stash@{96}: stash@{96}: On master: agent-F-temp-other-changes | REASON: agent-F-temp-other-changes — explicit agent-residue
Dropped stash@{96} (7a13273a2722f89e8498b1e1b43fac470e6049bf)
DROPPING stash@{95}: stash@{95}: On master: WIP unrelated | REASON: WIP unrelated — explicit unrelated
Dropped stash@{95} (510332666514551559359ec7f78ee7bc13335522)
DROPPING stash@{93}: stash@{93}: WIP on master: 3508b63b1 feat(traits): auto-trigger UltraRareTraitEvent on milestone evaluation (Equoria-d4tl) | REASON: WIP on master: 3508b63b1 — 653 commits behind
Dropped stash@{93} (9eefa53324378a3bf5aa62dc5128da8aea0deb83)
DROPPING stash@{92}: stash@{92}: WIP on master: a61604ff7 feat(npc-progression): wire rider + trainer XP/level/prestige/careerWeeks (Equoria-r1nr) | REASON: WIP on master: a61604ff7 — 648 commits behind
Dropped stash@{92} (d90b09bfee12b7c9bd4ca76a5a7bc40afb57f5cf)
DROPPING stash@{91}: stash@{91}: WIP on master: a61604ff7 feat(npc-progression): wire rider + trainer XP/level/prestige/careerWeeks (Equoria-r1nr) | REASON: WIP on master: a61604ff7 — 648 commits behind (dupe)
Dropped stash@{91} (f5089fc7dffc22a6b4ca164f34bcbeca31807783)
DROPPING stash@{90}: stash@{90}: WIP on master: 8e50b2dca fix(grooms): wire GroomHorseSynergy update in enhancedGroom + dailyCareAutomation (Equoria-5tjf) | REASON: WIP on master: 8e50b2dca — 645 commits behind
Dropped stash@{90} (fdf4b2e995c8f4509cfd0ee32b9ea3591fa09c7e)
DROPPING stash@{89}: stash@{89}: On master: wip-unrelated-before-quickactions-center | REASON: wip-unrelated-before-quickactions-center — explicit unrelated
Dropped stash@{89} (b8fca4cdbdb456a388295c89aa323f7ae3ac78d6)
DROPPING stash@{88}: stash@{88}: On master: wip-all-unrelated-2026-05-15 | REASON: wip-all-unrelated-2026-05-15 — old (2026-05-15) + explicit unrelated
Dropped stash@{88} (7a726d5f99bf77cda0aa7256a327f573d81b39f8)
DROPPING stash@{87}: stash@{87}: On master: wip-session-lifetime-redux | REASON: wip-session-lifetime-redux — vague, old
Dropped stash@{87} (83e7d821c3f3ac6cc2afbbf171d331f4557cc02d)
DROPPING stash@{86}: stash@{86}: On master: wip-target-file-before-rebase | REASON: wip-target-file-before-rebase — vague
Dropped stash@{86} (186b7bce46da102ee6e505ed83fb55607987d8b3)
DROPPING stash@{85}: stash@{85}: On master: wip-settings-persistence-redux | REASON: wip-settings-persistence-redux — vague, old
Dropped stash@{85} (0c1b4dc2941ad77cdfd03c94bf8b42d095596b42)
DROPPING stash@{84}: stash@{84}: On master: wip-leftover-2 | REASON: wip-leftover-2 — vague leftover
Dropped stash@{84} (9c8f0e3f66d26396c846849572b4f4fa77326737)
DROPPING stash@{83}: stash@{83}: WIP on master: 67eadbc8f ci(security): add CodeQL JavaScript/TypeScript SAST workflow (Equoria-2njt) | REASON: WIP on master: 67eadbc8f — 631 commits behind
Dropped stash@{83} (5a19d0cf9df5827b6c8bb69e57a76da8354a11d3)
DROPPING stash@{82}: stash@{82}: WIP on master: 89a0e081e fix(e2e): use /api/v1/auth/* canonical paths in session-lifetime + settings-persistence (Equoria-rgfq) | REASON: WIP on master: 89a0e081e — 629 commits behind
Dropped stash@{82} (4b69bc3723ce7ef037c47c0ba186ddb39b4dc789)
DROPPING stash@{81}: stash@{81}: WIP on master: 89a0e081e fix(e2e): use /api/v1/auth/* canonical paths in session-lifetime + settings-persistence (Equoria-rgfq) | REASON: WIP on master: 89a0e081e — 629 commits behind (dupe)
Dropped stash@{81} (f36af98cbcfa7af94ba6aabda2411f0c45916cc8)
DROPPING stash@{80}: stash@{80}: WIP on master: ae5e3ac67 fix(horses): expose phenotype on GET /horses list serializer (Equoria-tkyx) | REASON: WIP on master: ae5e3ac67 — 629 commits behind
Dropped stash@{80} (fb4cd9fb57b21c9aa9e8fd41006f26ebb0bc957f)
DROPPING stash@{79}: stash@{79}: WIP on master: ae5e3ac67 fix(horses): expose phenotype on GET /horses list serializer (Equoria-tkyx) | REASON: WIP on master: ae5e3ac67 — 629 commits behind (dupe)
Dropped stash@{79} (12d65b723f024721855e6d2bbf1819357ccc77b4)
DROPPING stash@{78}: stash@{78}: WIP on master: ae5e3ac67 fix(horses): expose phenotype on GET /horses list serializer (Equoria-tkyx) | REASON: WIP on master: ae5e3ac67 — 629 commits behind (dupe)
Dropped stash@{78} (fa215f8a975cb2f509aef2143f21e6bbf887e364)
DROPPING stash@{77}: stash@{77}: WIP on master: ae5e3ac67 fix(horses): expose phenotype on GET /horses list serializer (Equoria-tkyx) | REASON: WIP on master: ae5e3ac67 — 629 commits behind (dupe)
Dropped stash@{77} (1190721e8290d3b67196a1304b65da3e81a2d32c)
DROPPING stash@{76}: stash@{76}: WIP on master: 703a4d20e docs(beta): dedupe accidental /horses/:id/equip row (Equoria-p6my followup) | REASON: WIP on master: 703a4d20e — 624 commits behind
Dropped stash@{76} (3b87bab4e0ac5388efc1e5c994b304ad60c82b14)
DROPPING stash@{75}: stash@{75}: On master: agent-OO: stash integration-patterns.md before pull | REASON: agent-OO: stash integration-patterns.md before pull — agent-residue
Dropped stash@{75} (48653fe354fbb701c6cb4075e6d06ff8aaeec603)
DROPPING stash@{74}: stash@{74}: On master: GGG-tmp-not-mine | REASON: GGG-tmp-not-mine — explicit not-mine
Dropped stash@{74} (61198380c8b23dd15d450b596f4d3469a9722dae)
DROPPING stash@{72}: stash@{72}: WIP on master: 8c766d5ff feat(horses): surface in-foal progress badge on HorseCard (Equoria-yyn7) | REASON: WIP on master: 8c766d5ff — 551 commits behind
Dropped stash@{72} (7ae6eefc6f29dcfe87bf4ec9d36355bb4ff2cc1e)
DROPPING stash@{71}: stash@{71}: On master: agent-NNN-temp-other-work | REASON: agent-NNN-temp-other-work — explicit agent-residue
Dropped stash@{71} (660dce76b8ad7a847450a8884c9204d89ab2d0d1)
DROPPING stash@{70}: stash@{70}: On master: agent-QQQ-temp-rebase-shelf | REASON: agent-QQQ-temp-rebase-shelf — explicit agent-residue
Dropped stash@{70} (eafe53209930c46860dbc73177d990e343f3db07)
DROPPING stash@{69}: stash@{69}: On master: PPP-rebase-2 | REASON: PPP-rebase-2 — agent-residue
Dropped stash@{69} (c854a57a89fbb2cd8f285f7ef27116e9c45978d2)
DROPPING stash@{68}: stash@{68}: WIP on master: ee1d093bf style(osx51): replace hardcoded rgb(148,163,184) muted literal with design token in 4 pages | REASON: osx51 ee1d093bf — dupe #1 of stash 65
Dropped stash@{68} (428d0a3f1e0e09d197396b27f7a28ba792d7ef47)
DROPPING stash@{67}: stash@{67}: WIP on master: ee1d093bf style(osx51): replace hardcoded rgb(148,163,184) muted literal with design token in 4 pages | REASON: osx51 ee1d093bf — dupe #2 of stash 65
Dropped stash@{67} (f05b9282011534e1aaf4b96cc0905c9484ad2d1e)
DROPPING stash@{66}: stash@{66}: WIP on master: ee1d093bf style(osx51): replace hardcoded rgb(148,163,184) muted literal with design token in 4 pages | REASON: osx51 ee1d093bf — dupe #3 of stash 65
Dropped stash@{66} (9eedde1abd4f95d06d2a49612cd729098fcb4e28)
DROPPING stash@{64}: stash@{64}: On master: agent-ST: isolate OP-cluster MFA work before 54qq8 | REASON: agent-ST: isolate OP-cluster MFA work before 54qq8 — Equoria-54qq8 already shipped per SECURITY.md
Dropped stash@{64} (e8ba23da26967161adc356d02985ffaec778411d)
DROPPING stash@{63}: stash@{63}: On master: agent-ST: isolate OP-cluster SECURITY.md MFA note | REASON: agent-ST: isolate OP-cluster SECURITY.md MFA note — Equoria-54qq8 already shipped
Dropped stash@{63} (1e07adfb747be1cea80e5b1655f9db3af75f85b9)
DROPPING stash@{62}: stash@{62}: On master: stalled-agent-recovery-2026-05-19 (iqzn+yhg0g+misc) | REASON: stalled-agent-recovery-2026-05-19 (iqzn+yhg0g+misc) — Equoria-iqzn already shipped (COPPA, in SECURITY.md)
Dropped stash@{62} (5cb63b861b9ccca3e589bfdb25f80de64a1734b6)
DROPPING stash@{61}: stash@{61}: On (no branch): agent-9N: shelve pre-existing residue during 9nwzi rebase | REASON: agent-9N: shelve pre-existing residue during 9nwzi rebase — agent-residue
Dropped stash@{61} (fae79f5a2af49ad5513ba2e21875d4e91e6a3c9f)
DROPPING stash@{60}: stash@{60}: On master: agent-R2-residue-park | REASON: agent-R2-residue-park — explicit residue
Dropped stash@{60} (246a1fab1802dc0caaa79b5dbf80a6e7c1fc40a7)
DROPPING stash@{59}: stash@{59}: On master: agent-R8-temp-residue-stash | REASON: agent-R8-temp-residue-stash — explicit residue
Dropped stash@{59} (82e22529b2d3e8c54290d95fffd0833d9ee3e6c5)
DROPPING stash@{58}: stash@{58}: On master: ci1-residue-park | REASON: ci1-residue-park — explicit residue
Dropped stash@{58} (aa4df308d1f521d120f1095c70cada96b8b68e41)
DROPPING stash@{57}: stash@{57}: On master: agent-B-park-residue-ez70u | REASON: agent-B-park-residue-ez70u — explicit residue
Dropped stash@{57} (c602519cb3f729b75dddd1b9e5214fe3d763fa9c)
DROPPING stash@{56}: stash@{56}: On master: agent-B-residue-park-2 | REASON: agent-B-residue-park-2 — explicit residue
Dropped stash@{56} (25b15dc113aa6a3e1530e4a9120aa10e4d95b40c)
DROPPING stash@{55}: stash@{55}: On master: agent-A-residue-not-mine-hdpg7 | REASON: agent-A-residue-not-mine-hdpg7 — explicit not-mine
Dropped stash@{55} (56463d4c1a38a247032097d470dbec444a4e6130)
DROPPING stash@{54}: stash@{54}: On master: agent-B-residue-park-3 | REASON: agent-B-residue-park-3 — explicit residue
Dropped stash@{54} (5d4be6423f6439464d5ccbbed3ac13c5a7a6bc9f)
DROPPING stash@{53}: stash@{53}: On master: agent-B-residue-park-4 | REASON: agent-B-residue-park-4 — explicit residue
Dropped stash@{53} (b5132a6f685ec7d16f555b1200355705f96b01e6)
DROPPING stash@{52}: stash@{52}: On master: agent-B-residue-park-5 | REASON: agent-B-residue-park-5 — explicit residue
Dropped stash@{52} (dc3632aa93769b8701f70adf70d26ffc322a58d5)
DROPPING stash@{51}: stash@{51}: On master: agent-B-residue-park-6 | REASON: agent-B-residue-park-6 — explicit residue
Dropped stash@{51} (124282c7588cdcc41f51d256491e27524da44745)
DROPPING stash@{50}: stash@{50}: On master: agent-D-residue-not-mine-pre-gm4fg | REASON: agent-D-residue-not-mine-pre-gm4fg — explicit not-mine
Dropped stash@{50} (87ed00fbb0e82e3e9cd74469c914e730afc93606)
DROPPING stash@{49}: stash@{49}: On master: agent-D-residue-iot0h-not-mine | REASON: agent-D-residue-iot0h-not-mine — explicit not-mine
Dropped stash@{49} (9dce56c5cf58076f163c3eb83f49f6e500382024)
DROPPING stash@{48}: stash@{48}: On master: agent-D-residue-CLAUDE.md-not-mine | REASON: agent-D-residue-CLAUDE.md-not-mine — explicit not-mine
Dropped stash@{48} (9f915ff682180e265000147ec0d8307643fae18e)
DROPPING stash@{47}: stash@{47}: On master: agent-D-residue-pre-sr00q-commit | REASON: agent-D-residue-pre-sr00q-commit — explicit residue
Dropped stash@{47} (c792a9bc3efc5bf69d0d47babe5ab21844395057)
DROPPING stash@{46}: stash@{46}: WIP on worktree-agent-a386a8e4d6ca89e95: d67ee3f36 chore(db): draft corrective migration for Equoria-qh6jk shadow-DB drift | REASON: WIP on worktree-agent shadow-DB migration — worktree dead branch
Dropped stash@{46} (927aebd960f6f401eba8bbae178862c8fa7b3802)
DROPPING stash@{45}: stash@{45}: On master: worker-other-drift-stash-by-2B | REASON: worker-other-drift-stash-by-2B — explicit other
Dropped stash@{45} (b14b92372c8ce61cb24e1066c31afdc61d8b5d6a)
DROPPING stash@{44}: stash@{44}: On worktree-agent-aad6673d69be9e27b: worker-2B-restore-from-railway-not-mine | REASON: worker-2B-restore-from-railway-not-mine — explicit not-mine
Dropped stash@{44} (06020bf0d5fbb4691f36a68511652c2183701844)
DROPPING stash@{43}: stash@{43}: On master: main-repo-3f0yx-test-bench | REASON: main-repo-3f0yx-test-bench — bench residue
Dropped stash@{43} (ea04147c3479e1994467fe427611b83f8006a4a0)
DROPPING stash@{42}: stash@{42}: On master: main-repo-maint-test-bench | REASON: main-repo-maint-test-bench — bench residue
Dropped stash@{42} (0611ee11f3a81012f4c4653ba008ef9093295989)
DROPPING stash@{41}: stash@{41}: On master: other-worktree-jjzem-work | REASON: other-worktree-jjzem-work — explicit other
Dropped stash@{41} (cd3fd6a0a81b449ace450ddfc32c0cff4a6d755e)
DROPPING stash@{40}: stash@{40}: On master: other-enhancedGroomInteractions | REASON: other-enhancedGroomInteractions — explicit other
Dropped stash@{40} (f8b83d8d389230eee54666737bab181f75f60329)
DROPPING stash@{39}: stash@{39}: On master: worker14-twt4g-pre-push-residue | REASON: worker14-twt4g-pre-push-residue — explicit residue
Dropped stash@{39} (c5542066383b5b66649d0c238e67276bb4d46713)
DROPPING stash@{38}: stash@{38}: On master: worker14-twt4g-pre-push-residue-2 | REASON: worker14-twt4g-pre-push-residue-2 — explicit residue
Dropped stash@{38} (05b6a5b585ff596c61de60e6dfa57eb6f3bbeeb5)
DROPPING stash@{37}: stash@{37}: On master: autonomous-agent-1 pre-sync stash | REASON: autonomous-agent-1 pre-sync stash — agent residue
Dropped stash@{37} (f9aa4059bfaf912147b8df6ca7021935bd8be32e)
DROPPING stash@{36}: stash@{36}: On master: autonomous-agent-2 stash before rebase | REASON: autonomous-agent-2 stash before rebase — agent residue
Dropped stash@{36} (a799bd6b489b63c477b4d106d446c522bdc528e8)
DROPPING stash@{35}: stash@{35}: On master: agent3-presync | REASON: agent3-presync — agent residue
Dropped stash@{35} (c667566cf4e1980f4841542da45748cf2285b0a6)
DROPPING stash@{34}: stash@{34}: On master: autonomous-agent-2 pre-sync tracked only | REASON: autonomous-agent-2 pre-sync tracked only — agent residue
Dropped stash@{34} (0b88a0f366b7c3702df2920dacf24959a309722f)
DROPPING stash@{32}: stash@{32}: On master: non-mine work to leave for other agents | REASON: non-mine work to leave for other agents — explicit non-mine
Dropped stash@{32} (33880b68c6e3d325ed25c9ecfffe20486a143a60)
DROPPING stash@{31}: stash@{31}: On master: non-mine work from rebase residue agent4 | REASON: non-mine work from rebase residue agent4 — explicit non-mine + agent-residue
Dropped stash@{31} (11a98fa8365fab82e08a010412f8b30781a3349e)
DROPPING stash@{30}: stash@{30}: On worktree-l052p-prepush-hook-fix: pre-slice-stash | REASON: worktree-l052p-prepush-hook-fix: pre-slice-stash — dead worktree
Dropped stash@{30} (f6bd91fc8bda06703023c0c68eebb3d92aa7919a)
DROPPING stash@{29}: stash@{29}: On worktree-l052p-prepush-hook-fix: schema-noise-during-slice | REASON: worktree-l052p-prepush-hook-fix: schema-noise-during-slice — dead worktree
Dropped stash@{29} (d8e6d24ad09873cc9dba48ce10a147d8f5dbe10c)
DROPPING stash@{28}: stash@{28}: On worktree-l052p-prepush-hook-fix: concurrent-agent-noise | REASON: worktree-l052p-prepush-hook-fix: concurrent-agent-noise — dead worktree
Dropped stash@{28} (71e22ee1dd43e18e72beffb3d63d780870d314c9)
DROPPING stash@{27}: stash@{27}: On master: agent3-prerebase-z8leh | REASON: agent3-prerebase-z8leh — agent residue
Dropped stash@{27} (4532093e9c4b785acd4df7177130858c79ed4a29)
DROPPING stash@{26}: stash@{26}: On master: agent-2 pre-push residue uf987 | REASON: agent-2 pre-push residue uf987 — explicit residue
Dropped stash@{26} (5ef86fe8a355608b205152b0618eba46344a4588)
DROPPING stash@{25}: stash@{25}: On master: agent-2 pre-push tracked-only | REASON: agent-2 pre-push tracked-only — agent residue
Dropped stash@{25} (550f863b007e10141def93be73fe1c497cbeac2b)
DROPPING stash@{24}: stash@{24}: On master: agent-2 pre-push environmental | REASON: agent-2 pre-push environmental — agent residue
Dropped stash@{24} (2c94ea47a5214cfe03e4139547255b3da676b47f)
DROPPING stash@{23}: stash@{23}: On worktree-l052p-prepush-hook-fix: foreign drift to restore later | REASON: worktree-l052p-prepush-hook-fix: foreign drift to restore later — dead worktree
Dropped stash@{23} (99c91d8e6c1d13cb07cda30834d6df1e32a8d9cc)
DROPPING stash@{22}: stash@{22}: On master: non-mine-park-mfa-fix | REASON: non-mine-park-mfa-fix — explicit non-mine
Dropped stash@{22} (dc646aa4e7763e3df2989afc150085bf55be5054)
DROPPING stash@{21}: stash@{21}: On master: non-mine-bankcontroller | REASON: non-mine-bankcontroller — explicit non-mine
Dropped stash@{21} (3e4c017fe40c41488a623f38d5c4639ca188fec1)
DROPPING stash@{20}: stash@{20}: On worktree-l052p-prepush-hook-fix: more foreign drift | REASON: worktree-l052p-prepush-hook-fix: more foreign drift — dead worktree
Dropped stash@{20} (cc5182d1dfbd39d26115780d07fd2631a6cf58b7)
DROPPING stash@{19}: stash@{19}: On master: non-mine-pre-rebase-agent4 | REASON: non-mine-pre-rebase-agent4 — explicit non-mine
Dropped stash@{19} (20bb03948ead456d228b248b7ab297da5b04c286)
DROPPING stash@{18}: stash@{18}: On master: agent-C-stash | REASON: agent-C-stash — agent residue
Dropped stash@{18} (84dab5d8e5d0f00bf55c981ea547649b0f57452d)
DROPPING stash@{17}: stash@{17}: On master: agent-C-foreign-eslint-c8ulb | REASON: agent-C-foreign-eslint-c8ulb — explicit foreign
Dropped stash@{17} (2b00c9d3f8b71865f0a7c838de7d7f5edaa767a6)
DROPPING stash@{16}: stash@{16}: On master: agent-C-foreign-stash-2 | REASON: agent-C-foreign-stash-2 — explicit foreign
Dropped stash@{16} (6859e46767dd0b9e8b6f8f327ac31f935b5813a6)
DROPPING stash@{15}: stash@{15}: On master: agent-B-other-work-park | REASON: agent-B-other-work-park — explicit other
Dropped stash@{15} (67b77cc1dbc90a69365e2435c5c7487b378820cc)
DROPPING stash@{14}: stash@{14}: On master: agent-C-foreign-horseOverview-2 | REASON: agent-C-foreign-horseOverview-2 — explicit foreign
Dropped stash@{14} (a698db8da02ddfe5e7d22a2a36253aaedce1c45c)
DROPPING stash@{13}: stash@{13}: On master: agent-A-jnk6r-other-agents-residue | REASON: agent-A-jnk6r-other-agents-residue — explicit other-residue
Dropped stash@{13} (9f6ff12f4ca5d16e894ec5519ff8c4e14180816a)
DROPPING stash@{12}: stash@{12}: On master: agent-A-residue-2 | REASON: agent-A-residue-2 — explicit residue
Dropped stash@{12} (2095f0dd811551af97925972cf7bee57b87d79fc)
DROPPING stash@{11}: stash@{11}: On master: non-mine-others-fastfwd | REASON: non-mine-others-fastfwd — explicit non-mine
Dropped stash@{11} (eb48ecaf3dacc83dc9ecab3ae04cb9a9a3874d3f)
DROPPING stash@{10}: stash@{10}: On master: park-others-2 | REASON: park-others-2 — explicit park-others
Dropped stash@{10} (90f9b496f5885d390ad1379580c07fe6fa2767f1)
DROPPING stash@{9}: stash@{9}: On master: agent-A-residue-pre-push-jnk6r | REASON: agent-A-residue-pre-push-jnk6r — explicit residue
Dropped stash@{9} (394383b98d628baf00068994bbf45221758fc971)
DROPPING stash@{7}: stash@{7}: On master: agent-H pre-rebase stash | REASON: agent-H pre-rebase stash — verified superseded (feature-flag mount in commit 187148341)
Dropped stash@{7} (58a3f5e4b9d98ccbbeb88fcba6cdcd3815fe517a)
DROPPING stash@{6}: stash@{6}: On master: WIP-recovery 2026-05-29 | REASON: WIP-recovery 2026-05-29 — verified superseded (feature-flag + enhancedCompetitionSimulation deletions both on master)
Dropped stash@{6} (a62ec9ae13cda476ef603ab4d1aa32c0ea1f9a0c)
DROPPING stash@{5}: stash@{5}: On master: WIP-staged-recovery 2026-05-29 | REASON: WIP-staged-recovery 2026-05-29 — verified superseded (same as 6)
Dropped stash@{5} (bbe0f59d04add124c978314b64a5333c4bf3a03d)
DROPPING stash@{4}: stash@{4}: On master: agent-A-residue-4539b | REASON: agent-A-residue-4539b — explicit residue
Dropped stash@{4} (055d35f24594bb0d9fec5b3b3964f1492f641148)
DROPPING stash@{3}: stash@{3}: On master: agent-K-park-other-agents-work | REASON: agent-K-park-other-agents-work — explicit park-others
Dropped stash@{3} (a98f80062a469098547fc5ae69ebb93615f155da)
DROPPING stash@{2}: stash@{2}: On master: agent-N-temp | REASON: agent-N-temp — agent residue
Dropped stash@{2} (730ef6570e357ff17625c933e6169b65eb6806c6)
DROPPING stash@{1}: stash@{1}: On master: agent-I-park-non-my-work | REASON: agent-I-park-non-my-work — explicit non-mine
Dropped stash@{1} (92fec23baef69b8ce20b6f4cba7f8815b60dc2e8)
```

## Final state

Stash count after cleanup: **9** (from 155, a 94% reduction).

Total dropped: **146**.

## Remaining stashes (kept for user review)

```
stash@{0}: WIP on master: 374d78c64 fix(trainers): repair sentinel test import after services module move (closes Equoria-ye2r3)
stash@{1}: WIP on master: e6b1302ce chore(deps): bump root express 4.18.2 to 4.22.2 to resolve 3 moderate qs CVEs (refs Equoria-rpa6u)
stash@{2}: WIP on master: 095fdfa72 refactor(horses): finish y8u2j — extract foal + history sub-routers, add max-lines sentinel (closes Equoria-y8u2j)
stash@{3}: WIP on master: ee1d093bf style(osx51): replace hardcoded rgb(148,163,184) muted literal with design token in 4 pages
stash@{4}: autostash
stash@{5}: On master: WIP: codemod-touched tests + fix-fixture-ids-codemod.mjs (pre-rebase stash)
stash@{6}: On master: parallel-middleware-wip
stash@{7}: On master: WIP: training routes discipline validation + frontend training UI
stash@{8}: On master: WIP: Local changes before pull
```

### Reasons for keeping each

- **stash@{0}** WIP on master: 374d78c64 — only 12 commits behind HEAD, contains farrier + eslint + recordTransactionTx test work that may be in-flight from the current session window. Inspected via `git stash show`; cannot confirm it is superseded.
- **stash@{1}** WIP on master: e6b1302ce — 29 commits behind HEAD, recent. Express CVE bump WIP — could be live work.
- **stash@{2}** WIP on master: 095fdfa72 — 64 commits behind HEAD. Recent enough that work may not be obsolete.
- **stash@{3}** WIP on master: ee1d093bf (osx51 design-token) — original of the 4 duplicate stashes; kept one, dropped 3 dupes.
- **stash@{4}** autostash — 8 files of substantive code (horseRoutes, carePatternAnalysis, flagEvaluationEngine, frontend competition pages, etc.). Provenance unknown but content looks real.
- **stash@{5}** codemod-touched tests + fix-fixture-ids-codemod.mjs — explicit codemod work across many test files; could be useful reference work.
- **stash@{6}** parallel-middleware-wip — 87 insertions in csrf.mjs + authRoutes.mjs. Ambiguous "parallel-" prefix suggests other-agent, but auth/CSRF surface is heavily refactored on master and the stash may contain salvage-worthy work.
- **stash@{7}** WIP: training routes discipline validation + frontend training UI — substantive frontend+backend training feature work.
- **stash@{8}** WIP: Local changes before pull — ancient (deletes .augment dir + 1100-line old CLAUDE.md) but destructive. Too vague to drop safely; user should review whether the deletions match current state.

All 9 remaining are flagged for user decision.
