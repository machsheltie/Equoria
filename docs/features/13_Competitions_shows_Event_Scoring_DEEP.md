EQUORIA DESIGN BIBLE  •  VOLUME 13 OF 23
13. Competitions, Shows & Event Scoring
Recovered design intent • consolidated 6 October 2026
Purpose of this volume
Reconstructs Equoria’s competition engine in detail: eligibility and search, show hosting, exact 24-discipline stat-weight map, score components, riders/health/luck, prizes/stat gains/player XP, three active slots, result history, conformation/parade systems and special Cups/events.

Canonical status snapshot
LOCKED	Standard age 3–20, rider required, max three simultaneous show slots, no general show cooldown.

LOCKED	Shows run 7 days after creation; search includes discipline/level/fee/prize/run date and 20/page.

LOCKED	24-discipline 50/30/20 stat map; rider ±; luck ±1–10; prizes 50/30/20; Horse Points 1/3/5/10 by result; seasonal game events double Horse Points.

LOCKED	Conformation 70/20/10 and Parade 50/30/20 baselines.

OPEN	Health vocabulary, training-score conversion, item/tack values and some host/economy balancing.

Competition philosophy
Design intent
Competitions convert long-term horse development into records, earnings and lineage significance. They must reward breeding/training/rider choices while retaining bounded uncertainty. They are not energy-spam battles and should not require hidden premium power.

Core horse entry rules
•	Horse age: 3–20 for standard competition under the recovered rules.
•	Horse must meet the show’s level/range requirement where levels are used.
•	A rider must be assigned and eligible.
•	Horse cannot be entered twice in the same show.
•	Horse may compete in any discipline; discipline fit is expressed through stats/training/rider/trait rather than a hard one-discipline-only horse lock.
•	There is no general competition cooldown.
•	Each horse may occupy at most three simultaneous show/competition slots.
•	Older generic “health/training requirement” and weekly horse-entry caps appeared in overview documents; later explicit rules supersede them unless a specific event defines a requirement.
Competition search and entry UX
•	Filters: Discipline, Level, Entry Fee, Prize and Run Date.
•	Only shows the horse/player has not already entered should appear in the entry search.
•	20 shows per page was explicitly defined.
•	Once entered, the show disappears from the unentered search/list and the horse’s active-entry count updates.
•	Discipline is a flat list in the player search UI; do not group disciplines into Western/English/Specialty categories in the actual selection control unless explicitly revisited.
•	Saved competition search preferences were discussed as premium QoL; core filtering remains free.
Show timing and player-hosted shows
•	Shows run seven days after creation.
•	Basic users may create/host up to 10 user shows per week.
•	Premium users were explicitly given a proposed/accepted allowance of 100 shows per week; because this is a very large difference it should be fairness-reviewed before launch.
•	Entry fees go to the host in the early economy design.
•	Show creation needs discipline, level/range, entry fee, prize and run date/processing state.
Discipline stat model
Each standard discipline uses three stats with a 50% / 30% / 20% weighting. This table is one of the strongest recovered rule sets and should be treated as the canonical starting map unless intentionally rebalanced.
Discipline	50% primary	30% secondary	20% tertiary
Western Pleasure	Focus	Obedience	Intelligence
Reining	Agility	Precision	Focus
Cutting	Intelligence	Agility	Boldness
Barrel Racing	Speed	Agility	Obedience
Roping	Precision	Focus	Speed
Team Penning	Intelligence	Agility	Stamina
Rodeo	Boldness	Agility	Stamina
Hunter	Balance	Precision	Intelligence
Saddleseat	Flexibility	Balance	Obedience
Endurance	Stamina	Intelligence	Speed
Eventing	Stamina	Boldness	Agility
Dressage	Precision	Focus	Obedience
Show Jumping	Balance	Agility	Boldness
Vaulting	Flexibility	Balance	Obedience
Polo	Speed	Boldness	Agility
Cross Country	Stamina	Boldness	Intelligence
Combined Driving	Obedience	Stamina	Focus
Fine Harness	Flexibility	Precision	Balance
Gaited	Flexibility	Balance	Obedience
Gymkhana	Speed	Flexibility	Focus
Steeplechase	Stamina	Boldness	Balance
Racing	Speed	Stamina	Focus
Harness Racing	Speed	Precision	Stamina
Pleasure Driving	Obedience	Balance	Focus

Competition score components
Component	Recovered rule
Horse stats	Weighted 50/30/20 from the discipline map.
Matching trait	+5 when the horse’s relevant trait matches the discipline requirement/advantage.
Discipline training	Training/development contribution described on a 0–100 scale; exact conversion from weekly +5 needs normalization.
Tack/equipment	Appropriate tack/gear bonus was part of the score model; final item values open.
Rider compatibility	Good pairing +0–10%; incompatible pairing penalty 0–8%.
Health	Older table: Excellent +5%, Very Good +3%, Good 0, Fair −3%, Bad −5%.
Random/luck	Bounded ±1–10% modifier.
Temperament / conformation / gaits	Minor compatibility bonuses/penalties were proposed in later overview docs; do not double-count without a final formula.

Health scoring conflict
The competition modifier table uses Excellent / Very Good / Good / Fair / Bad. A later care/health design uses Good / Fair / Poor / Critical. Before implementation, normalize these vocabularies and percentages in one place. Do not let different screens compute different health modifiers from different state names.
Placements, prizes and development rewards
Placement	Prize share	Chance of +1 required stat	Early player XP
1st	50% of prize pool	10%	+20 XP
2nd	30%	5%	+15 XP
3rd	20%	3%	+10 XP

Post-show stat gain
•	When the placement stat-gain roll succeeds, increase one stat that is actually used by that discipline by +1.
•	This is separate from weekly training’s +5 discipline development.
•	The result history should record whether a stat increased and which stat.
•	Do not confuse the 10/5/3% post-show stat-gain chances with injury or prize probabilities.
Competition result record
•	Show/event name and ID.
•	Discipline.
•	Run date.
•	Horse and rider.
•	Placement/rank and score.
•	Prize/earnings.
•	Player XP award.
•	Any +1 post-show stat gain.
•	Health/injury result if triggered.
•	Titles/Cup/seasonal awards.
•	Result remains visible in horse history and contributes to records/legacy.
Processing model
•	Entry phase: submit eligible horse/rider into a scheduled show.
•	Processing phase: server-authoritative simulation after the run date, using stable rule version and auditable inputs.
•	Results phase: placements, earnings, XP, stat gains, injuries and titles recorded/distributed.
•	Scheduled jobs/background processing were explicitly discussed.
•	Competition history should not be recomputed from current stats later; preserve the historical result.
Conformation shows — separate competition type
Design intent
Conformation is not the same as discipline performance. The recovered baseline score is 70% conformation / 20% presentation / 10% temperament.

•	Conformation uses body/overall ratings and breed/age/class organization once classes are finalized.
•	Presentation can be influenced by grooming, show handling and appropriate items without changing inherited anatomy.
•	Temperament affects ring behavior/presentation.
•	A later alternative proposal used roughly 60–70% conformation, 15–25% groom handling, 5–10% bond and 5–10% temperament. Preserve as alternate proposal, not replacement of the accepted 70/20/10 baseline.
•	Age-1+ eligibility and more detailed classes were proposed but not locked.
Parades
Design intent
Recovered parade score baseline: 50% presentation / 30% movement or gait / 20% temperament.

•	Parades are presentation-heavy and can support prestige, cosmetics, groom/show-handler value and seasonal themes.
•	Monthly parade-style events were discussed.
•	Do not merge parade score with conformation score.
Holiday Cups, prestige and special events
•	System-run holiday Cups have enhanced prize pots.
•	Horse pages should display earned medals, cups and titles.
•	Prestige shows may require qualifying wins or top leaderboard finishes (proposal).
•	Sponsored tournaments and team multi-horse/relay formats were proposed.
•	Special-event brainstorms included Jousting, Chariot Racing, Mounted Combat, Foraging, Backcountry, Costume/Masquerade, Dance, Puzzle Course, Liberty, Gauntlet and Thunderdash. These are event concepts, not evidence that combat/fantasy becomes the core genre.
Leaderboards attached to competition
•	Weekly/seasonal discipline leaderboards were proposed in competition planning.
•	Global, regional and friends-only scopes appeared historically; global/guild/time-based rankings later became the stronger general leaderboard direction.
•	Legacy Points / lineage prestige from top competition were proposed and feed Section 14; final formula belongs there.
Do-not-drift guardrails
Lock against reinterpretation
Use the explicit 24-discipline flat list and 50/30/20 map. Do not reintroduce a generic weekly horse competition cooldown or energy bar. Do not group disciplines into Western/English categories in the player selection list. Keep discipline competition, conformation and parade scoring separate. Bounded luck must not overwhelm breeding/training/rider strategy.

Open decisions still requiring an explicit lock
•	Normalize health-state vocabulary/modifiers.
•	Define exact training-value scale and conversion into competition score.
•	Define tack/item bonus ranges and prevent stacking exploits.
•	Confirm whether matching-trait +5 is flat score points or percent.
•	Final show-level system if horse levels are retained.
•	Fairness review of 10 vs 100 user-hosted shows/week.
•	Conformation classes/ages and whether later groom/bond weighting replaces or supplements 70/20/10.
Recovery provenance & precedence
This file is a reconstruction of Equoria’s discussed design intent. It intentionally preserves conflicts and historical alternatives instead of silently normalizing them.
Precedence used here: later explicit user decisions outrank older plans; direct user constraints outrank assistant proposals; mockup values are examples unless independently locked; reported implementation is not treated as canonical design if it conflicts with a later decision.
•	2025 competition/legacy/economy/crafting/events/community planning conversations
•	2026 reconstruction and updated comprehensive feature inventory
•	Equoria Competition Systems Overview and related UI/project-plan files
Use of this document
Treat LOCKED and CURRENT material as the governing design baseline unless Stacey explicitly revises it. Treat PLANNED material as intended scope that still needs implementation-level definition. Treat EXPLORATORY material as archived possibilities. Treat SUPERSEDED material as historical context only and do not reintroduce it accidentally.
When implementation requires a decision that this document marks OPEN, create a discrete design decision record rather than allowing code, mockups, or an AI-generated rewrite to choose by implication.

 SECOND-DEPTH RECONSTRUCTION PASS
Deep recovery: event taxonomy, entry processing, scoring, schedules, leaderboards, and records
Added 5 October 2026 • source-audited against the re-uploaded historical files
Evidence discipline. Evidence labels used in this deep pass: SOURCE-EXPLICIT means the uploaded historical material states the requirement directly; RECOVERED-CANON means the first reconstruction pass already preserved a user-directed rule from the earlier chat history; DERIVED-CONTRACT restates supported requirements as an implementation obligation without adding new balance; HISTORICAL/MOCKUP records a contemplated implementation or presentation but does not promote it to canon; OPEN means the source record does not resolve the decision.

Competition catalog and eligibility
•	[SOURCE-EXPLICIT] Discipline catalog recovered: Western Pleasure, Reining, Cutting, Barrel Racing, Roping, Team Penning, Rodeo; Hunter, Saddleseat, Dressage, Eventing, Show Jumping, Vaulting; Polo, Cross Country, Combined Driving, Fine Harness, Gaited, Gymkhana, Racing, Steeplechase, Harness Racing; Endurance. Pleasure Driving added by the owner on 2026-10-21.
•	[SOURCE-EXPLICIT] Entry requirements historically referenced age, health, training and assigned/eligible rider; later current rules must be used where they supersede early weekly caps/cooldowns.
•	[DERIVED-CONTRACT] Event records must specify discipline, class/age/other eligibility, entry fee/prize, schedule/run time, capacity if any, scoring configuration and whether system/player-created/special/prestige/team.
Processing and scoring contract
•	[SOURCE-EXPLICIT] Competition processing has Entry -> server Processing/Simulation -> Results. Inputs include weighted horse stats, discipline training, rider compatibility, temperament suitability, bounded randomness and potentially conformation/gaits.
•	[RECOVERED-CANON] The first bible preserves the 24-discipline 50/30/20 primary-stat map and later competition rules. That map remains the baseline unless a discipline receives an explicit revision.
•	[DERIVED-CONTRACT] Scores should be reproducible/auditable from stored entry snapshots plus a recorded random seed/modifier range if randomness is used. A later stat change must not rewrite a completed result.
•	[DERIVED-CONTRACT] Duplicate entry prevention from the early competition module remains a valid integrity requirement.
Schedules, auto-run, and results
•	[SOURCE-EXPLICIT] Week 4 expected system and player-created shows scheduled to auto-run in the next 48 hours. Results distribute placements, money and XP and write horse competition history/player stats.
•	[SOURCE-EXPLICIT] Competition Hub UI required discipline/age/entry-fee filters, event schedule, prize pool, requirements, Enter action, history and leaderboard access.
•	[DERIVED-CONTRACT] Once processing begins, entry data should be locked. Results should atomically update competition history, earnings, player XP, relevant leaderboard/prestige/legacy records and any injury event.
Leaderboards and special formats
•	[SOURCE-EXPLICIT] Weekly and seasonal leaderboards by discipline were planned, with global/regional/friends views discussed. Week 4 specifically listed player XP, horse earnings and horse wins leaderboards.
•	[SOURCE-EXPLICIT] Special events included themed/sponsored tournaments, seasonal championships, team relay/team-score formats and prestige shows requiring qualifying wins or leaderboard finishes.
•	[DERIVED-CONTRACT] Leaderboards are projections from authoritative results, not independent counters. Resetting a seasonal leaderboard must not delete horse career history.
Exact Week 4 competition/leaderboard data interfaces
•	[SOURCE-EXPLICIT] GET /leaderboard/xp -> top players by XP; GET /leaderboard/earnings -> top horses by total prize money; GET /leaderboard/wins -> top horses by first-place wins.
•	[SOURCE-EXPLICIT] GET /shows/upcoming -> system and player-created shows scheduled to auto-run in the next 48 hours.
•	[SOURCE-EXPLICIT] GET /feed/recent -> recent shows/winners, training events and level-ups; a 10–20 item limit was suggested.
•	[SOURCE-EXPLICIT] Dashboard data included upcoming show run dates and which owned horses were entered. Horse overview included most recent show result.
•	[DERIVED-CONTRACT] These endpoints can be renamed in a future architecture, but the information responsibilities remain useful acceptance criteria for competition/home surfaces.
Source trace for this deep pass
Source	How it is used here
Equoria Competition Systems Overview.docx	Evidence for requirements/history; exact authority depends on whether the source is a rule file, implementation plan, UI mockup, or reconstructed user-directed canon.
Competition Hub Design.docx	Evidence for requirements/history; exact authority depends on whether the source is a rule file, implementation plan, UI mockup, or reconstructed user-directed canon.
Week 3.docx	Evidence for requirements/history; exact authority depends on whether the source is a rule file, implementation plan, UI mockup, or reconstructed user-directed canon.
week 4.docx	Evidence for requirements/history; exact authority depends on whether the source is a rule file, implementation plan, UI mockup, or reconstructed user-directed canon.
Complete project plan.docx	Evidence for requirements/history; exact authority depends on whether the source is a rule file, implementation plan, UI mockup, or reconstructed user-directed canon.
UI Design.docx	Evidence for requirements/history; exact authority depends on whether the source is a rule file, implementation plan, UI mockup, or reconstructed user-directed canon.
first-pass Volume 13	Evidence for requirements/history; exact authority depends on whether the source is a rule file, implementation plan, UI mockup, or reconstructed user-directed canon.
Deep-pass acceptance checks
•	[DERIVED-CONTRACT] A future implementation can identify which values are locked versus open without guessing from a mockup.
•	[DERIVED-CONTRACT] Any historical rule that conflicts with a later correction is visibly marked and cannot silently return through copied code/tests.
•	[DERIVED-CONTRACT] The UI can be redesigned without deleting the underlying system responsibilities or authoritative records.
•	[DERIVED-CONTRACT] Server/domain logic remains the source of eligibility, scoring, economy and permissions; clients render and request actions rather than inventing rules.
•	[DERIVED-CONTRACT] If a required rule is unsupported by the recovered record, it remains OPEN and is routed to an explicit design decision instead of being fabricated.

 CANONICAL DECISION UPDATE — 6 OCTOBER 2026
Direct owner decisions from the 5–6 October 2026 design-lock session. These decisions outrank earlier mockups, examples and assistant-generated interpretations.
Horse Points, competition levels and Prestige qualification
Horse Points awards
•	[LOCKED] Every completed competition earns Horse Points, including non-placement.
•	[LOCKED] Non-placement = 1 Horse Point; 3rd = 3; 2nd = 5; 1st = 10.
•	[LOCKED] Game-run special seasonal event competitions award double Horse Points: 2 / 6 / 10 / 20 for non-placement / 3rd / 2nd / 1st.
•	[LOCKED] Every 1,000 Horse Points earns one player-directed stat allocation. Players may bank Points/earned allocations indefinitely and deploy multiple saved allocations strategically.
•	[LOCKED] Horse Points are separate from player XP, prize money, Horse Prestige and Legacy.
•	[OPEN] The older random post-show +1-stat chance has not yet been explicitly reconciled with the newer Horse Points/stat-allocation system; do not remove or stack it silently.
Competition level
•	[LOCKED] “Horse level” means competition level/weight for a particular competition type. There is no generic universal horse level.
•	[OPEN] Exact competition-level bands, recalculation timing after stat allocation and any anti-sandbagging rules still require explicit design.
Horse Prestige opportunities
•	[CURRENT] Horse Prestige should unlock invitationals, championship qualification, prestigious parades/exhibitions, cosmetic tack/presentation rewards, titles, profile treatments, ribbons/trophies, breeding-market visibility, registry recognition, leaderboards and eventual Hall-of-Fame eligibility.
•	[LOCKED] Prestige does not directly increase competition score or genetic quality.
•	[OPEN] Horse Prestige calculation is the next design task: event class, competition level, placement, field quality/size, repeat wins and discipline breakdown have not yet been given final weights.
