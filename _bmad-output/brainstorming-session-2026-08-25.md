---
title: 'Game Brainstorming Session'
date: '2026-08-25'
author: 'Heirr'
version: '1.0'
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
---

# Game Brainstorming Session

## Session Info

- **Date:** 2026-08-25
- **Facilitator:** Game Designer Agent
- **Participant:** Heirr

---

_Ideas will be captured as we progress through the session._

## Brainstorming Approach

**Selected Mode:** Guided — focused design interrogation

**Techniques Available:**

1. Evidence Triangulation
2. Scale-Ladder Stress Testing
3. Player-Role and Workflow Mapping
4. Reference Blending with Anti-Pattern Inversion
5. Information–Artwork Tension Exploration
6. Asset-Led Interaction Design
7. MDA Framework Exploration
8. Accessibility Layers
9. What-If Scenarios
10. Adversarial Elicitation

**Focus Areas:**

- Stable Home information hierarchy
- Horse Roster as a distinct but closely related workspace
- Supporting 5–50+ horses without implying one active horse
- Supporting hundreds of manually entered show entries and repeated player-driven tasks
- Reducing hunting, confusion, and navigation without automating meaningful gameplay labor
- Portrait and ledger modes with shared state and clearly differentiated purposes
- Roster-entry information and progressive disclosure
- Search, filters, sorting, saved views, and grouping
- Multi-selection and organizational behavior without batch feeding, vetting, task completion, or show entry
- Desktop efficiency and mobile recomposition
- Preserving prominent horse artwork at scale
- Avoiding both SaaS-dashboard sterility and single-companion-game framing
- Borrowing useful RPG interaction and visual patterns
- Evaluating competitors through Keep / Avoid / Translate for Equoria
- Redesigning the Stable from first principles rather than decorating the existing dashboard
- Discovering bespoke game-UI asset needs from the selected visual directions instead of prescribing plaques or frames in advance
- Alignment with DESIGN.md and ART_DIRECTION.md
- Treating PRODUCT.md as historical context rather than redesign authority
- Validation against the linked design conversation, current Stable implementation, reference images, and stable sizes of 5, 20, 50, and 200 horses

**Evidence Authority:**

1. Heirr's current corrections and stated product intent
2. DESIGN.md and ART_DIRECTION.md where consistent with that intent
3. Current implementation as evidence of behavior and failure modes
4. PRODUCT.md as historical context only

## Ideas Generated — Running Capture

**[Navigation #1]: World-Facing Destination Bar**
_Core Loop_: The persistent bottom navigation presents five primary realms—HOME, WORLD, COMMUNITY, MARKETPLACE, and COMPETE. HOME is a category/submenu title rather than a destination screen; selecting it opens an authored secondary destination menu containing Profile, Avatar customization, Stable, Bank, and Inventory. World exposes the Veterinarian, Feed Shop, Tack Shop, Training Center, Breeding Specialist, and Leathersmith; Community exposes the Forum, Clubs/Associations, and Leaderboard; Marketplace exposes the Horse Trader, Horse Marketplace, Grooms for Hire, Riders, and potentially Trainers; Compete exposes Under Saddle and Conformation. A compact top HUD centers the EQUORIA name and keeps coins/Bank, notifications, settings, and logout available.
_Novelty_: Navigation is framed as moving among game places and activities instead of operating a SaaS sidebar or hamburger drawer. Secondary menus must use an authored game-native presentation rather than generic dropdown or mobile-app sheet conventions.

**Decision:** The current generic hamburger/sidebar navigation is rejected as part of the SaaS-like shell. The coin display acts as a persistent shortcut to Bank, while Bank remains in HOME for discoverability and categorical completeness. HOME is not a page and is not synonymous with Stable; it is the submenu title for the player's personal destinations. Avatar customization belongs in HOME. The exact desktop and phone recomposition, Trainers placement, and persistent News access remain to be resolved.

**[Navigation #2]: Equoria Chronicle Return Point**
_Core Loop_: Game News automatically opens on login but must remain revisitable. Treat News as a persistent game-world publication rather than a disposable login modal. The leading direction is a Chronicle/News control in the top HUD, potentially integrated with the centered EQUORIA wordmark and marked with an unread-news ribbon or seal. News remains distinct from personal notifications so announcements, releases, events, and patch information do not compete with horse/player alerts.
_Novelty_: Recasts system announcements as an authored piece of the world—an Equoria Chronicle, gazette, or noticeboard—while preserving immediate access from every screen.

**Chronicle/wordmark rule:** Chronicle remains an explicit labeled top-HUD control. The centered EQUORIA wordmark is decorative brand identity and is intentionally noninteractive; it does not hide a duplicate Chronicle or Home action.

**[World #1]: Equoria Town as an Immersive Destination**
_Core Loop_: WORLD can offer an illustrated Equoria town hub where the player's shops and specialists exist as visible places. Buildings, signs, doors, windows, and environmental landmarks act as clickable entrances with authored hover/focus illumination. The town is an optional immersive route; direct submenu destinations remain available for players making repeated visits.
_Novelty_: The same beautiful exterior and interior location art becomes spatial worldbuilding instead of disconnected page backgrounds. Players can choose efficient fast travel or pleasurable exploration without either audience controlling the other. A shop can provide an environmental “Return to Town” exit, preserving the sense of place.

**Decision:** Equoria Town is the first destination in the WORLD submenu, followed by direct links to Veterinarian, Feed Shop, Tack Shop, Training Center, Breeding Specialist, and Leathersmith. This seven-destination structure stays within the submenu's designed capacity while preserving both exploration and fast travel.

**Town composition and visual canon:** Equoria Town is a focused service-quarter scene rather than an exhaustive whole-town directory. Its six WORLD specialist buildings are the interactive foreground destinations; other districts may appear at a distance to imply a larger world without becoming another navigation index. The existing Feed Shop, Tack Shop, and Equine Hospital exteriors are canonical landmark designs and should be preserved when composing the service-quarter panorama. Matching exterior designs must be authored for the Training Center, Breeding Specialist, and Leathersmith. Each building may use a separate restrained interactive treatment—lantern or window warmth, sign illumination, threshold sparkles, or focused outline—while accessible names and interaction states remain DOM-owned. Shop interiors may offer an environmental Return to Town exit.

**New landmark archetypes:** The Training Center is an open arena complex with a distinctive covered ring, illuminated rails, and visible training grounds rather than another shopfront. The Breeding Specialist occupies an elegant cottage or small manor with restrained celestial genealogy motifs, communicating scholarship and lineage rather than veterinary medicine. The Leathersmith is a warm timber workshop with hanging tack, a working chimney, and the craft character already established by the existing `farriershop.webp` interior. Distinct silhouettes and activity cues must make all three recognizable before labels are read.

**Clickable-map boundary:** Equoria Town is one deliberately composed clickable map, not six location illustrations rearranged into a separate mobile street. A proposed vertically reconstructed mobile town and horizontal map panning are both rejected. Mobile must preserve the identity and overall composition of the authored main map rather than asking players to traverse a carousel, sideways panorama, or replacement sequence of destination scenes. Responsive interaction should be achieved through DOM-owned hotspots, labels, focus states, and destination feedback layered over the map—not by redesigning the town as a list.

**Town interaction rule:** Every building hotspot uses one-step travel. One click, tap, or keyboard activation immediately opens the selected location; there is no select-then-confirm state and no additional Visit button. Desktop hover and keyboard focus may illuminate the building and expose its name before activation, but mobile does not require an exploratory first tap. Hotspots must be generously sized, non-overlapping, accessible controls so direct travel remains reliable rather than becoming easy to trigger accidentally.

**Provisional mobile-label rule:** Because touch has no hover and activation travels immediately, the current mobile fallback keeps all six destination names visible at rest through small environmentally integrated sign treatments rather than generic pins or floating application buttons. This is provisional pending the final town composition: the labels may be replaced by a more intuitive art-led affordance if it preserves immediate destination recognition, one-tap travel, and accessibility without placing excessive writing over the map.

**[Navigation #3]: Three-Layer World Map**
_Core Loop_: Equoria's navigation is a durable mental map rather than a directory of software modules. Layer one is the persistent realm map—HOME, WORLD, COMMUNITY, MARKETPLACE, and COMPETE. Layer two is each realm's authored destination menu. Layer three is contextual travel: clicking the coin balance can open Bank, an unread seal can open the Chronicle, and a horse-care requirement can lead to the relevant world location. Contextual travel supplements but never replaces the global realm map.
_Novelty_: Intentional duplication is allowed when one occurrence teaches world structure and the other accelerates a frequent contextual journey. Secondary menus contain destinations, not dashboard summaries, statistics, or task widgets. The selected realm and destination must remain visually unmistakable.

**[Navigation #4]: Stateful Fast Travel**
_Core Loop_: Selecting a realm reveals its destinations without navigating to a placeholder page. On desktop, mouse and optional keyboard travel are mechanically immediate; on touch devices, a labeled secondary destination strip recomposes immediately above the five-realm bottom bar. No destination depends on hover discovery. Authored transitions may reinforce place and atmosphere but cannot delay repeated travel.
_Novelty_: Navigation preserves play context rather than treating every destination as a fresh web page. Leaving and returning to Stable restores the player's roster mode, filters, grouping, sort, page or virtual position, selections, and scroll position. Contextual shortcuts accelerate travel for large-stable players without automating care, training, breeding, or show entry.

**Stakeholder requirement:** New players need named, learnable places; established players need reliable cross-location return state; 100+ horse players need immediate travel with no decorative friction; mobile players need touch-visible secondary destinations rather than nested drawers.

**[Navigation #5]: Durable Realm Taxonomy**
_Core Loop_: The five realm controls are category switches, not destination pages, and visually communicate that they reveal a destination layer. New destinations should fit the durable taxonomy: HOME contains the player's personal identity, horses, possessions, and finances; WORLD contains specialist services and physical locations; COMMUNITY contains communication, organizations, and rankings; MARKETPLACE contains hiring, trading, and player-to-player commerce; COMPETE contains competition families and can expand beyond Under Saddle and Conformation.
_Novelty_: The destination layer is designed for at least eight entries rather than today's count. Profile means public identity/achievements/player information, while Avatar means appearance customization. The earlier proposal for a generic mobile 2×3 or 2×4 tableau is rejected. Instead, the visible bottom realm control itself opens its own authored secondary menu; after the player selects a destination, the destination page loads and the submenu disappears. This is a direct realm-to-destination disclosure, not a hidden all-purpose hamburger drawer.

**Assumption safeguards:** HOME needs an explicit open-category state so it is not mistaken for a destination. Bank duplication is intentional. The desktop and mobile HUDs may recompose because the centered wordmark, coins, Chronicle, notifications, settings, and logout cannot be assumed to fit at every width.

**[Navigation #6]: World-Framing, Not App-Shell Replacement**
_Core Loop_: Replacing the hamburger is insufficient if the result is five equal rectangular tabs plus a generic popover. Realm controls need authored silhouettes, crests, materials, and unmistakable selected states; their destination layer behaves like immediate game-world travel rather than a skinned software dropdown. Navigation frames the illustrated world and collapses after travel instead of permanently boxing the content.
_Novelty_: Shared navigation remains learnable, but locations are not identical page templates with swapped backgrounds. Stable, Veterinarian, Feed Shop, Marketplace, and COMPETE can have location-specific compositions, signature controls, and authored assets while retaining common usability conventions.

**Pre-mortem safeguards:**

- Establish a visual-chrome budget so the top HUD, realm bar, and temporary destination panel never crowd the horse art or roster.
- Keep authored transitions brief, interruptible, and mechanically immediate for high-volume players.
- Do not allow Stable to remain a summary-and-card dashboard under a decorative skin; horses, organization, and player-directed work lead its hierarchy.
- Recompose mobile HUD/navigation deliberately around the persistent primary realm bar. A realm's submenu appears only after that visible realm is selected and dismisses after destination selection; it must not become an all-purpose drawer, bottom sheet, or disguised hamburger.
- Present the Equoria Chronicle as an authored publication/archive with artwork and event notices, not corporate release notes.
- Acceptance test: with decorative textures temporarily removed, hierarchy and interaction must still differ materially from SaaS; restored assets then make it unmistakably Equoria.

**[Stable Home #1]: Atmosphere → Roster → Workload**
_Core Loop_: For a player arriving with a large stable, the first-five-seconds hierarchy is: (1) stable identity and atmosphere, (2) immediate access to the Horse Roster, and (3) workload orientation. The screen must establish arrival at the player's illustrated stable before presenting management information. Roster access is prominent but does not turn Stable Home into the roster itself. Aggregate work signals remain subordinate and should be integrated into the stable-world composition rather than presented as equal-weight dashboard cards.
_Novelty_: The Stable Home is neither a single-companion showcase nor an operations dashboard. It is an authored place that orients the player, provides a clear doorway into large-scale horse organization, and quietly communicates relevant stable conditions without automating the work.

**[Stable Home #2]: Last Night's Standouts**
_Core Loop_: Stable Home showcases a small group of the player's best-performing horses from the previous night's show results, prioritizing horses with first-, second-, and third-place finishes. If shows ran but no horse placed in the top three, it still showcases the best finishers among the horses that competed. Random horses are used only when the player had no shows run at all. These are celebratory residents of the stable scene—not an active-horse selection, relationship system, or recommended task queue. Selecting a showcased horse can open its horse profile.
_Novelty_: Beautiful owned-horse artwork becomes evidence of the player's recent play and the stable's living history. The prestige state can justify bespoke winner treatments—ribbons, lantern highlights, ceremonial framing, result marks, or a stable-honors motif—without making every roster entry ornate or turning the page into a results dashboard.

**Performance rule:** “Top” means the horses that earned the most total show points during the previous nightly results run. Points accumulate across every entered show and placement according to Equoria's scoring table—for example, 10 points for first, 5 for second, and 3 for third. A horse with ten second-place finishes and three thirds outranks a horse with a single first because its nightly point total is higher. The spotlight ranks horses by total nightly points rather than best single finish.

**Presentation rule:** Featured horses are shown through their artwork plus a restrained total-points indicator. The Stable Home does not display a full first/second/third breakdown beside each horse; the primary composition remains celebratory and atmospheric rather than becoming a miniature results table.

**Showcase count:** Stable Home always features the top three horses from the previous nightly show-point ranking. A fixed three creates a legible nightly-honors ritual and prevents the showcase from expanding into a second roster. When no shows ran, three random stable residents appear without performance prestige treatment.

**[Stable Home #3]: Three Operational Signals**
_Core Loop_: Stable Home reserves its subordinate workload layer for exactly three aggregate signals: horses requiring care, horses currently able to train, and breedable mares. These signals orient the player's next decision but do not perform care, training, breeding, show entry, or any other meaningful gameplay work.
_Novelty_: A deliberately limited operational vocabulary prevents the Home from regrowing into an equal-weight dashboard. It highlights three recurring horse-management decisions while leaving detailed discovery, sorting, and horse-by-horse action inside the Roster and relevant game locations.

**Operational-signal visual boundary:** Three separate equal hanging markers are rejected as too close to a miniature KPI row. Stable Home instead uses one authored hanging Stable Rounds marker containing three interactive lines: Requires Care, Can Train, and Breedable Mares. It is mounted naturally to the fence or barn, remains subordinate to the scene, and recomposes as one compact unit on mobile. Each line has a bespoke icon, count, short label, focused illumination state, and direct filtered-Roster destination.

**Handoff rule:** Each operational signal is a deep filter into the Horse Roster. Selecting “requires care,” “can train,” or “breedable mares” opens the separate Roster with that filter already applied. The filtered result supports finding and opening horses but does not expose bulk completion of care, training, breeding, or show entry.

**[Horse Roster #1]: Player-Owned Density**
_Core Loop_: Every new player enters the Horse Roster in Portrait mode, regardless of stable size. Ledger mode is available only when deliberately selected by the player. The Roster remembers that preference but never automatically switches modes when the stable crosses a horse-count threshold.
_Novelty_: Equoria introduces players through its horse artwork instead of beginning with a spreadsheet, while respecting expert players who later choose higher information density. Growth does not unexpectedly rewrite the interface or imply that large-stable play must become visually joyless.

**[Horse Roster #2]: Hard Portrait/Ledger Information Boundary**
_Core Loop_: Portrait entries are reserved for horse artwork, identity, sex, age, breed, and concise care/training/breeding states. The complete numerical stat block is prohibited from Portrait mode. Detailed stats and sortable comparisons belong in Ledger mode and the individual horse profile.
_Novelty_: The two modes solve genuinely different player jobs rather than presenting the same dashboard cards at two sizes. Portrait supports recognition and attachment to a large collection; Ledger supports analysis and high-density comparison. Neither mode compromises the other.

**Portrait-entry hierarchy:** The horse illustration remains free of overlaid names, metadata, badges, and status text. A restrained engraved stable sill beneath the artwork carries the horse name as the strongest text, followed by one concise sex · age · breed line and the consistent Care/Training/Breeding state rail. This creates a readable repeated rhythm without turning entries into application cards or obscuring the commissioned artwork.

**Portrait-entry interaction:** The entire Portrait entry is one generous link to the horse profile. It contains no inline care, training, breeding, show-entry, or overflow-menu controls. The three-state rail describes the horse but does not perform actions. This keeps touch behavior predictable, prevents nested interactive controls, and sends the player into the individual horse workflow before meaningful gameplay actions are taken.

**[Horse Roster #3]: Barn-Based Organization**
_Core Loop_: Equoria does not add open-ended folders, custom tags, or saved productivity views to the core Roster. Horses are organized through a concise stable-world vocabulary: All Horses, Mares, Stallions, Colts, Fillies, and Retired. These categories should read as barns or stable divisions rather than generic application tabs.
_Novelty_: The organization model remains immediately understandable, grounded in horse management, and resistant to feature-creep. Filters handle temporary questions; barns provide the stable's durable structure.

**Barn assignment rule:** Barn membership is automatic and authoritative. Age, sex, and retirement state determine whether a horse appears under Mares, Stallions, Colts, Fillies, or Retired; players do not manually move horses between these factual classifications. All Horses remains the complete stable view.

**Barn selector asset rule:** All Horses, Mares, Stallions, Colts, Fillies, and Retired each receive a bespoke emblem paired with a visible text label. Colts and Fillies use distinct young-horse imagery without relying only on gendered color; Retired uses a peaceful pasture/rest motif. The selected barn receives lantern-gold illumination while inactive divisions remain indigo. Icons never replace labels.

**Rejected barn-selector scale:** The large two-by-three architectural directory studies are far too bulky. Barn selection is frequent navigation, not a hero feature, and must not consume a major portion of the viewport or push horse artwork below the fold. Players scrolling long rosters must never be forced to return to the page top just to change barns. The final selector must remain compact and continuously reachable while preserving visible labels and one-step barn switching.

**Approved compact barn rail:** Mobile uses a slim sticky shared rail containing two compact rows of three barn choices, approximately 72–88px total rather than a large illustrated directory. Each choice pairs a small bespoke 16–20px emblem with its visible label and understated horse count. The selected barn receives restrained lantern-gold emphasis; the other divisions remain legible indigo. The rail stays pinned beneath the compact HUD while the horse collection scrolls, while the larger Horse Roster title may scroll away. Desktop recomposes the same six choices into one slim row. Horse artwork begins immediately beneath the rail.

**[Horse Roster #4]: Competition Eligibility Belongs to COMPETE**
_Core Loop_: The Horse Roster does not filter or classify horses by an exclusive competition discipline because every horse can technically compete across disciplines. In COMPETE, the player selects the competition's discipline and level; that specific competition page then lists only eligible horses. Horses younger than 3 or older than 21 do not appear as enterable, and any discipline/level requirements are evaluated in the context of the selected competition.
_Novelty_: The Roster remains a stable-management surface instead of absorbing show-entry logic. COMPETE owns exact eligibility because the question is not “what discipline is this horse?” but “which horses qualify for this particular event at this discipline and level?”

**Roster filter scope:** Name, age, and coat-color filters are excluded. Horses appear alphabetically when no sort/filter changes are active, and players can use device/browser text finding when seeking an exact name. The remaining filter capabilities are Breed, Requires Care, Can Train, Breedable, In Foal, For Sale, and At Stud. Seven available predicates must not become seven permanently visible phone controls.

**[Horse Roster #5]: Dedicated Refinement Workflow**
_Core Loop_: Barns remain the visible primary Roster grouping. A single, clearly labeled Refine Roster control opens a dedicated mobile filter view rather than a drawer, bottom sheet, hamburger, or permanently expanded row of controls. Applying filters returns to the Roster, which displays one concise human-readable filter summary and a clear reset action. Desktop may expose the same refinement controls in an optional side area without changing their semantics.
_Novelty_: Filter capability is separated from filter chrome. Context removes irrelevant predicates: Mares may expose Breedable and In Foal but not At Stud; Stallions may expose At Stud but not In Foal; Colts and Fillies omit adult breeding states. Stable Home's three operational signals remain immediate filtered entrances without requiring the player to configure the refinement view.

**[Horse Roster #6]: No Bulk-Action Mode**
_Core Loop_: The Horse Roster has no persistent multi-select state and no bulk-action toolbar. Filters identify relevant horses; selecting an entry opens that individual horse. Care, training, veterinary work, breeding, selling, and show entry remain individual player decisions and actions. COMPETE and the Breeding Specialist own their specific horse-selection workflows.
_Novelty_: Equoria supports large collections without erasing gameplay labor. Automatic barns remove the only obvious organizational reason for batch selection, so the interface does not invite forbidden automation or turn horses into spreadsheet rows awaiting mass processing.

**[Horse Roster #7]: Predictable Portrait, Sortable Ledger**
_Core Loop_: Portrait mode remains alphabetical within the active barn and filters and does not add a separate sort control. Ledger opens alphabetically but permits sorting through its useful displayed columns. Switching Portrait/Ledger preserves barn and filter context; Ledger-only sorting does not alter Portrait's alphabetical order.
_Novelty_: Browsing remains spatially predictable for art-led recognition, while analytical ordering appears exactly where dense comparison is expected. This also removes unnecessary sorting chrome from the mobile Portrait header.

**Mobile Portrait recomposition:** Portrait mode uses a two-column horse gallery on typical phones. Each entry retains artwork, identity, sex/age/breed, and concise care/training/breeding states. One column is reserved for genuinely narrow viewports or accessibility text scaling rather than offered as another player-facing density control.

**[Horse Roster #10 — Selected Visual]: Open Celestial Barn Gallery**
_Core Loop_: Portrait mode uses a hybrid of connected barn architecture and independent artwork breathing room. Each row shares a light timber canopy and/or sill, with slender supports establishing stable bays, but horses are not enclosed in a heavy floor-to-ceiling timber cage and do not become isolated framed cards. Open gutters reveal the celestial night between entries. Identity and the three-state rail remain consistently aligned.
_Novelty_: Shared structure makes the collection feel physically housed in Equoria's stable world; negative space, celestial blue, gold inlay, and selective lantern points keep the gallery luminous and premium. The final treatment uses lighter beams, more breathing room, more visible night atmosphere, and more restrained gold than the first connected-gallery study. Desktop can use three bays across; typical phones recompose to the approved two-column gallery.

**Mobile Ledger recomposition:** Ledger remains a horizontally scrollable semantic data table rather than becoming expandable cards. Horse identity is frozen in the first column; statistic columns scroll horizontally beneath persistent sortable headers. Visible edge fading or another continuation cue communicates additional columns. Horse names open profiles. The visual treatment may use an authored indigo stable-ledger surface, but text, columns, sorting, and accessibility remain DOM-owned.

**Ledger identity treatment:** The frozen horse-identity column includes a restrained 40–48px artwork thumbnail alongside the horse name. The thumbnail preserves rapid visual recognition and Equoria's art presence without making rows card-sized or undermining Ledger density.

**[Horse Roster #8]: Continuous Alphabetical Collection**
_Core Loop_: Each barn presents one continuous alphabetical roster rather than numbered pages. Portrait artwork lazy-loads as the player scrolls, while horse names remain discoverable. Returning from a horse or another location restores the exact barn, filters, mode, and scroll position. Ledger uses the same continuous horse set.
_Novelty_: Large-stable browsing feels like moving through a collection rather than paging through search results. An optional A–Z jump index may accelerate long rosters. Any future progressive-loading strategy must preserve name discovery and must not silently make unloaded horses impossible to find through device-level text search.

**[Horse Roster #9]: Consistent Three-State Rail**
_Core Loop_: Every Portrait entry reserves the same three positions for Care, Training, and Breeding state. Consistency supports fast scanning across many horses. Care communicates settled versus attention required; Training communicates ready versus cooldown; Breeding communicates the applicable state such as breedable, in foal, at stud, or unavailable.
_Novelty_: Bespoke Equoria state icons replace repetitive generic pills and icon-library dependence. Inactive states remain subdued rather than disappearing, and visible short labels plus fuller assistive text ensure meaning never depends on color or image alone.

**Visible-state rule:** Because the full Portrait entry is one profile link, the status rail does not contain separate tap-to-explain controls. Each fixed position pairs its bespoke icon with a short visible state label: Care uses Well or Needs Care; Training uses Ready or Resting; Breeding uses Breedable, In Foal, At Stud, or an em dash when inapplicable. These labels are engraved into the shared sill treatment rather than rendered as colored pills. Assistive text may provide fuller meaning, but sighted touch users never need hover or an extra tap to interpret the rail.

**Training-time rule:** When a horse cannot yet train, the Portrait Training position replaces the generic Resting label with a rounded remaining duration such as `2h 15m`. It never displays seconds or a visually noisy continuously ticking timer. Ready remains the available state; the horse profile may expose the exact completion timestamp and fuller cooldown detail.

**Ledger boundary:** The core Ledger contains frozen horse identity, breed/sex/age, the three care/training/breeding states, and all twelve competition statistics. Total earnings is intentionally excluded as unimportant to everyday Roster comparison and belongs in horse performance or financial history instead. Genotype, pedigree, detailed show history, equipment, and sale pricing likewise remain outside the core Ledger.

**[Stable Home #4]: Complete-Art Stable Openings**
_Core Loop_: The nightly top-three showcase preserves each horse's complete illustrated artwork, including its painted environment, inside bespoke stable architecture such as stall openings, arched viewing bays, or another authored spatial treatment. The core Stable Home does not require transparent cutouts for every owned horse.
_Novelty_: The composition avoids generic cards while respecting the existing art pipeline. Transparent horse cutouts may still be commissioned selectively for prestige reveals, events, onboarding, or marketing, but they are not a prerequisite for a horse to appear in Stable Home or the Roster.

**Horse-art format rule:** The horse-art pipeline will provide intentionally composed portrait and landscape variants. Equoria should select the appropriate authored variant for each surface instead of deriving incompatible layouts through aggressive automatic crops. Horses, legs, tails, and other important silhouette details must remain inside each variant's safe composition area; responsive CSS controls sizing and framing but does not invent the artwork's composition.

**Top-three composition:** The nightly point leader occupies a larger central stable opening, with second and third in smaller flanking openings. Mobile recomposes to a full-width first-place artwork above second and third sharing the next row. Horse name and total nightly points remain visible; authored lantern light, ribbon, and placement ornament communicate rank. The hierarchy is explicitly temporary performance prestige, not an active-horse system.

**Concept validation:** The generated Stable Home concept strongly validates the top-three architectural composition and its overall scene-first layout. The mockup's exact plaque density and evenly segmented bottom bar remain provisional rather than approved requirements.

**[Stable Home #5]: Luminous Barn Threshold**
_Core Loop_: The barn entrance itself is the Horse Roster gateway, but it does not carry a permanent “HORSE ROSTER” sign. Warm gold light spills through the doors, with restrained sparkling motion and a subtle pull toward the threshold to communicate entry. Selecting the doorway opens the separate Horse Roster.
_Novelty_: The signature control is part of the location rather than a floating web CTA. Motion is not the sole affordance: the doorway retains a strong static glow/contrast state, receives an authored hover/focus response with a small “View Horses” label, exposes an accessible screen-reader label, and respects reduced-motion settings. Mobile receives the persistent glow and may use a one-time onboarding cue. The interaction guides without shouting or adding another permanent generic text block.

**[Visual Direction #1 — Selected]: Lantern Honors Yard**
_Core Loop_: Lantern Honors Yard is the definitive leading Stable Home direction. It balances roughly two-thirds grounded painted stable with one-third celestial wonder: white barn architecture, dark timber, midnight-indigo surfaces, warm lantern glass, restrained gold, luminous blue wildflowers, and a quiet horse constellation. The scene contains the top-three architectural showcase, luminous barn threshold, single Stable Rounds marker, compact HUD, and authored five-realm travel ribbon.
_Novelty_: This direction won decisively over the more ornate Celestial Stable Gallery and the more grounded Working Stable at Midnight. Its controls physically inhabit the illustrated location, preserving modern clarity without becoming a skinned dashboard, old horse-game website, or fantasy-RPG frame.

**[Navigation Asset #1]: Engraved-to-Painted Destination Emblems**
_Core Loop_: Secondary destination menus use original bespoke engraved-line emblems paired with DOM text. At rest they remain light, readable gold linework on the shared indigo submenu ribbon. Hover, keyboard focus, and selection introduce restrained painted color, lantern glow, and richer material depth. The selected destination receives the strongest treatment.
_Novelty_: This hybrid leans decisively toward the lighter engraved study, preserving the world and rapid scanning while avoiding generic icon-library dependence. Full painted pictograms are reserved for location entrances, onboarding, rewards, and promotional surfaces where their visual weight is appropriate.

---

## Themes and Patterns

1. **Place before panels:** Stable Home and Equoria Town are authored locations whose architecture carries navigation and interaction. Information is integrated into the world instead of distributed among equal dashboard cards.
2. **Collection-scale play without automation:** Filters, barns, ledger sorting, deep links, and state restoration reduce hunting for players with 5–200 horses, while every meaningful horse action remains individually performed.
3. **Artwork and analysis have separate homes:** Stable Home celebrates three recent standouts; Portrait supports recognition and identity; Ledger supports dense comparison; horse profiles own deep detail.
4. **One-step, reversible interaction:** Barn switching, town travel, roster entry, and Stable Home gateways avoid unnecessary confirmation steps. Destructive or consequential gameplay remains in its owning workflow.
5. **Authored identity with DOM-owned meaning:** Bespoke frames, emblems, thresholds, signs, texture, illumination, and prestige ornaments establish Equoria's visual authorship. Responsive layout, labels, tables, state text, filtering, and accessibility remain semantic DOM.
6. **Persistent context, restrained chrome:** The five-realm travel ribbon and compact HUD preserve orientation, while location submenus disappear after travel and the Roster restores barn, filters, mode, sort, and scroll position.
7. **Mobile is recomposed, not impoverished:** Portrait remains a two-column art gallery; Ledger remains a semantic horizontal table; barn switching remains compact and sticky; the Town preserves its authored clickable-map composition without horizontal traversal.

## Promising Combinations

- **Lantern Honors Yard + Luminous Barn Threshold:** The Stable Home's strongest visual fantasy and its primary Roster gateway become one environmental interaction rather than a scenic background with a floating CTA.
- **Stable Rounds + Dedicated Refinement:** The three Stable Home workload signals become immediate prefiltered Roster entrances, while the separate Refine Roster workflow handles less frequent combinations without expanding Home into an operations dashboard.
- **Open Celestial Barn Gallery + Compact Sticky Barn Rail:** Large-scale horse browsing retains artwork and stable-world architecture while frequent barn switching stays continuously reachable and visually subordinate.
- **Portrait/Ledger Boundary + Exact State Restoration:** Players can alternate between visual recognition and dense analysis without losing their barn, filters, horse position, or preferred mode.
- **Equoria Town + Direct WORLD Fast Travel:** Immersive exploration and high-frequency efficiency coexist; neither route is forced on every visit.
- **Responsive Art Variants + DOM Overlay System:** Purpose-composed portrait/landscape artwork preserves visual quality, while semantic labels, hotspots, states, and sizing adapt independently and remain accessible.

## Ideation Session Summary

- **Developed concepts:** 24
- **Primary decision domains:** Navigation, Stable Home, Horse Roster, responsive behavior, visual direction, and authored asset language
- **Selected Stable direction:** Lantern Honors Yard
- **Selected Roster direction:** Open Celestial Barn Gallery with compact sticky barn navigation
- **Core product boundary:** Equoria supports large-stable management through discovery and organization, never through bulk completion of meaningful gameplay labor

---

## Session Summary

### Most Promising Concepts

**Top Pick: Lantern Honors Yard + Separate Horse Roster**  
This combination most directly solves the central tension. Stable Home becomes an unmistakable authored game location, while the separate Roster supports large-scale horse management without forcing either the atmosphere or the data density to compromise the other.

**Runner-up: Open Celestial Barn Gallery + Ledger Pair**  
The two-mode system gives artwork and analysis distinct, durable roles. Portrait remains beautiful and recognizable at collection scale; Ledger provides the dense comparison expected by experienced players.

**Honorable Mention: Equoria Town + Direct WORLD Fast Travel**  
The clickable map turns existing location art into spatial worldbuilding while preserving direct destination access for repeated high-volume play.

### Key Insights

- Equoria's scale problem is primarily a discovery and state-restoration problem, not a justification for batch automation.
- The strongest anti-SaaS move is structural: make Stable Home a place, make Roster modes purpose-specific, and let signature controls inhabit the world.
- Authored assets and semantic DOM are complementary. Art should own identity and silhouette; DOM should own live information and interaction.
- Mobile succeeds through deliberate recomposition and persistent compact navigation, not through hidden menus or shrinking desktop compositions indiscriminately.
- Efficient one-step travel is compatible with immersion when direct fast travel and environmental navigation coexist.

### Recommended Next Steps

1. Use the completed Equoria Stable UX / Visual Brief as the authority for wireframes and asset planning.
2. Create a compact asset production specification for the Stable Home, Portrait gallery, sticky barn rail, Ledger, and global travel ribbon.
3. Prototype and validate the Stable-to-Roster interaction with representative large-stable datasets before final visual production.

---

## Session Complete

**Date:** 2026-08-26  
**Participant:** Heirr

### Output

This session produced:

- 24 developed concepts
- 7 cross-cutting themes
- 6 promising combinations
- 1 consolidated Stable UX / Visual Brief

### Document Status

Status: Complete  
Steps Completed: [1, 2, 3, 4]
