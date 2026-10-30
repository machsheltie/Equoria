# Coat Color Names: Game vs Owner List

**Status:** Active runbook
**Owner:** Project owner
**Last verified:** 2026-10-30
**Load only when:** renaming coat colors or adding new coat colors (Equoria-7woyj), or answering the owner's coat-color naming questions
**Do not load for:** markings, white patterns (tobiano, overo, sabino, splash), portraits of other breeds, or breed odds unrelated to color names
**Live sources:** `backend/modules/horses/services/phenotypeCalculationService.mjs` (`calculatePhenotype`, `grayColorNames`, `appaloosaPatternNames`, `appaloosaMinimalNames`), `backend/modules/horses/services/coatShade.mjs`, `backend/modules/horses/services/genotypeGenerationService.mjs` (`CORE_LOCI`, `GENERIC_STARTER_WEIGHTS`), `backend/modules/horses/services/markingGenerationService.mjs` (sooty, flaxen, pangare flags), `backend/modules/horses/data/coatImages.mjs`, `backend/data/breeds/*.txt` (`allowedAlleles`, `alleleWeights`, `shadeBias`), `frontend/src/lib/coatColor.ts` (`colorWithShade`)
**Retire when:** Equoria-7woyj lands the owner's names and a test pins the full name set

The owner supplied a new master list of coat color names on 2026-10-29 (207
lines, 206 distinct names; Equoria-igbrz). This page maps every color name the
game can produce or show today against that list. It is a review only: no game
behavior was changed. The owner's answers to the flagged items decide the
rename and new-color work in Equoria-7woyj.

## Owner answers 2026-10-30 (q317-q320, Equoria-mxu1y)

This page is a 2026-10-29 snapshot; the tables below are not updated. The
names the game produces now are pinned by
`backend/modules/horses/__tests__/coatColorNaming.test.mjs`, so the page's
retire condition is met.

- q317: "wild cream pearl" is Wild Buckskin Pearl and "yellow dun" is
  Dunskin (both already named). **Mushroom Palomino Pearl** (chestnut,
  mushroom, one cream, pearl) and **Wild Amber Cream Champagne** (wild bay,
  champagne, one cream, no pearl) are now named. No breed carries mushroom
  or wild bay yet.
- q318: Dominant White Sabino and Compound Dominant White stay.
- q319: strawberry roan stays folded into Red Roan.
- q320: Classic Palomino American Saddlebreds have their own two portraits
  (`classicpalomino1/2.webp`). Until q321 the Saddlebred's Palomino shades
  never rolled the standard shade, so only existing Classic Palomino Saddlebreds show
  them; `backend/scripts/assign-classic-palomino-portraits.mjs` gives those
  without a picture one.
- q321: the Saddlebred's Palomino shades are light, golden, classic, dark and
  chocolate, each 0.2, so new Saddlebreds roll Classic Palomino too. Old
  shades map pale -> Light Palomino and copper -> Dark Palomino;
  `backend/scripts/rename-saddlebred-palomino-shades.mjs` renames existing
  Saddlebreds and gives them their color's portrait.

## How the inventory was built

- **Color names** come from the name calculation in
  `phenotypeCalculationService.mjs`. Every combination of every allele any
  breed file allows (plus the no-breed fallback weights) was run through
  `calculatePhenotype`, which gives 74 base/dilution/roan names, 9 gray names,
  11 appaloosa names, Dominant White, Brindle and the Unknown fallback: 97 in
  all.
- **Breeds** is how many of the 312 breed files can produce the name with
  their own alleles. Breeding is same-breed only, so a name with 0 breeds can
  be produced by the code but by no horse today.
- **Shades** come from each breed's `shadeBias`. A player sees
  `colorWithShade`: the color name, then the shade, e.g. "Bay — Copper"; a
  "standard" shade is not shown. The local database's breed rows carry the
  same shade keys as the seed files, and every color stored on a local horse
  is in the 97.
- **Markings flags** sooty, flaxen (chestnuts only), pangare and rabicano are
  random, inherited flags shown under markings, never in the color name. They
  are not genes in the genetics table.
- **Portraits:** `coatImages.mjs` (American Saddlebred only) maps colors and
  shades to the owner's portrait names; that match was owner-approved (q269),
  so it is used below as evidence for shade renames.
- The New Player Guide and other frontend text name no coat colors.

## Counts

| Class                                          | Count                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| (a) game name exactly on the owner list        | 34 (one-to-one)                                                       |
| (b) same color, worded differently             | 28 game names + 22 shown color/shade pairs; they cover 49 owner names |
| (c) game name with no owner equivalent         | 35 names, plus the shade words listed under C                         |
| (d) owner name the game cannot produce or name | 123 of 206                                                            |

Of the 123 in (d): 3 need only a new shade; 30 use genes the game already
has but the name calculation drops a part; 25 add sooty, flaxen or pangare to
the name; 17 use mushroom (gene exists, unused); 12 need a new allele of an
existing gene (wild bay, more dominant-white alleles); 35 need a new gene
(snowdrop, sunshine); 1 is ambiguous.

## A. Exact matches

| Game name                | Owner name               | Breeds | Note                                                                                                                |
| ------------------------ | ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Amber Champagne          | amber champagne          | 13     |                                                                                                                     |
| Amber Cream Champagne    | amber cream champagne    | 12     |                                                                                                                     |
| Bay Dun                  | bay dun                  | 308    |                                                                                                                     |
| Bay Pearl                | bay pearl                | 3      |                                                                                                                     |
| Bay Roan                 | bay roan                 | 120    | also what a roan Buckskin, Bay Dun or Dunskin is called today                                                       |
| Blue Roan                | blue roan                | 120    | also what a roan Smoky Black, Grulla or Smoky Grulla is called today                                                |
| Buckskin Pearl           | buckskin pearl           | 11     | bay + one cream + one pearl                                                                                         |
| Classic Champagne        | classic champagne        | 13     |                                                                                                                     |
| Classic Cream Champagne  | classic cream champagne  | 12     |                                                                                                                     |
| Cremello                 | cremello                 | 29     |                                                                                                                     |
| Dunalino                 | dunalino                 | 94     |                                                                                                                     |
| Dunskin                  | dunskin                  | 94     | also what a silver Dunskin is called today                                                                          |
| Gold Champagne           | gold champagne           | 13     |                                                                                                                     |
| Gold Cream Champagne     | gold cream champagne     | 12     |                                                                                                                     |
| Grulla                   | grulla                   | 308    |                                                                                                                     |
| Mushroom Chestnut        | mushroom chestnut        | 0      | no breed carries mushroom; only the no-breed fallback (test fixtures) can make it                                   |
| Perlino                  | perlino                  | 29     | also what a silver Perlino is called today                                                                          |
| Red Dun                  | red dun                  | 311    |                                                                                                                     |
| Red Roan                 | red roan                 | 120    | also what a roan Palomino, Red Dun or Dunalino is called today                                                      |
| Sable Champagne          | sable champagne          | 1      |                                                                                                                     |
| Sable Cream Champagne    | sable cream champagne    | 1      |                                                                                                                     |
| Seal Perlino             | seal perlino             | 1      |                                                                                                                     |
| Silver Amber Champagne   | silver amber champagne   | 4      |                                                                                                                     |
| Silver Bay               | silver bay               | 16     |                                                                                                                     |
| Silver Bay Dun           | silver bay dun           | 16     |                                                                                                                     |
| Silver Bay Roan          | silver bay roan          | 13     |                                                                                                                     |
| Silver Classic Champagne | silver classic champagne | 4      |                                                                                                                     |
| Silver Grulla            | silver grulla            | 16     |                                                                                                                     |
| Silver Sable Champagne   | silver sable champagne   | 0      |                                                                                                                     |
| Smoky Black              | smoky black              | 94     |                                                                                                                     |
| Smoky Black Pearl        | smoky black pearl        | 11     | black + one cream + one pearl                                                                                       |
| Smoky Cream              | smoky cream              | 29     | also what a silver Smoky Cream is called today                                                                      |
| Smoky Grulla             | smoky grulla             | 94     |                                                                                                                     |
| Dominant White           | dominant white           | 8      | every dominant-white allele shows this one name today; the owner's two allele-specific white entries are in table D |

## B. Same color, worded differently

Rename the game name to the owner's name. Two game names each cover two owner
colors (marked SPLIT) and four gray names merge into fewer owner names
(marked MERGE).

| Game name               | Rename to (owner name)                                                                                    | Breeds | Note                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amber Dun Champagne     | amber champagne dun                                                                                       | 12     | word order                                                                                                                                                                                                                                                                                                    |
| Apricot                 | chestnut pearl                                                                                            | 3      | chestnut + two pearl                                                                                                                                                                                                                                                                                          |
| Bay                     | standard bay                                                                                              | 305    | shown as plain "Bay" when its shade is standard or the breed has no Bay shades; the other Bay shades are in the shade table                                                                                                                                                                                   |
| Black                   | nonfading black                                                                                           | 305    | shade "standard"; shade "faded" is fading black (shade table)                                                                                                                                                                                                                                                 |
| Buckskin                | classic buckskin                                                                                          | 94     | plain Buckskin (no shade); confirm with the owner — the approved portrait match uses classic buckskin for the "burnished" shade                                                                                                                                                                               |
| Chestnut                | standard chestnut                                                                                         | 308    | plain Chestnut (no shade); the shades are in the shade table                                                                                                                                                                                                                                                  |
| Classic Dun Champagne   | classic champagne dun                                                                                     | 12     | word order                                                                                                                                                                                                                                                                                                    |
| Gold Dun Champagne      | gold champagne dun                                                                                        | 12     | word order                                                                                                                                                                                                                                                                                                    |
| Ivory Champagne         | gold cream pearl; amber cream pearl champagne; classic cream pearl champagne; sable cream pearl champagne | 12     | SPLIT: the game gives one name to two genotypes. Champagne + one cream + one pearl on chestnut/bay/black/seal = the owner's four "cream pearl champagne" names (one per base). Champagne + two cream (true ivory) has no owner name — see the flagged items; the owner did supply an Ivory Champagne portrait |
| Pale Gold               | palomino pearl                                                                                            | 11     | chestnut + one cream + one pearl; 11 breed files already call it "Palomino Pearl"                                                                                                                                                                                                                             |
| Palomino                | classic palomino                                                                                          | 94     | plain Palomino (no shade); confirm with the owner; shades are in the shade table                                                                                                                                                                                                                              |
| Pearl Black             | black pearl                                                                                               | 3      | word order; 12 breed files already call it "Black Pearl"                                                                                                                                                                                                                                                      |
| Sable Dun Champagne     | sable champagne dun                                                                                       | 0      | word order                                                                                                                                                                                                                                                                                                    |
| Seal Brown              | standard seal brown                                                                                       | 1      | plain Seal Brown; its three shades (dark, light, sealskin) are in the shade table                                                                                                                                                                                                                             |
| Seal Brown Dun          | seal dun                                                                                                  | 0      | owner drops "brown"                                                                                                                                                                                                                                                                                           |
| Seal Brown Pearl        | seal pearl                                                                                                | 0      | owner drops "brown" (see flagged items)                                                                                                                                                                                                                                                                       |
| Silver Dapple           | silver black; silver smoky black                                                                          | 16     | SPLIT: one game name for two genotypes — black + silver = silver black; black + silver + one cream = silver smoky black. 16 breed files already list shades under "Silver Black"                                                                                                                              |
| Silver Roan             | silver blue roan                                                                                          | 13     | black + silver + roan                                                                                                                                                                                                                                                                                         |
| Silver Seal Brown       | silver seal                                                                                               | 0      | owner drops "brown"                                                                                                                                                                                                                                                                                           |
| Gray                    | dapple grey                                                                                               | 239    | early-stage default gray; the owner-approved portrait match (q269) shows it as dapple grey; spelling grey                                                                                                                                                                                                     |
| Steel Gray              | steel grey                                                                                                | 239    | spelling                                                                                                                                                                                                                                                                                                      |
| Rose Gray               | rose grey                                                                                                 | 239    | spelling                                                                                                                                                                                                                                                                                                      |
| White Gray              | white grey                                                                                                | 239    | spelling                                                                                                                                                                                                                                                                                                      |
| Fleabitten Gray         | fleabitten grey                                                                                           | 239    | spelling                                                                                                                                                                                                                                                                                                      |
| Steel Dark Dapple Gray  | dapple grey                                                                                               | 239    | MERGE: portrait match (q269) already shows it as dapple grey                                                                                                                                                                                                                                                  |
| Steel Light Dapple Gray | light dapple grey                                                                                         | 239    | portrait match (q269)                                                                                                                                                                                                                                                                                         |
| Rose Dark Dapple Gray   | rose grey                                                                                                 | 239    | MERGE: portrait match (q269) shows it as rose grey; owner list has no rose dapple                                                                                                                                                                                                                             |
| Rose Light Dapple Gray  | rose grey                                                                                                 | 239    | MERGE: as above                                                                                                                                                                                                                                                                                               |

Shades: these show today as "Color — Shade" and are the owner's name in a
different form.

| Shown today           | Owner name                     | Note                                                                                       |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| Bay — Standard        | standard bay                   | shown as plain "Bay"                                                                       |
| Bay — Dark            | mahogany bay                   | portrait match q269                                                                        |
| Bay — Light           | golden bay                     | portrait match q269                                                                        |
| Bay — Blood           | blood bay                      | word order                                                                                 |
| Bay — Copper          | copper bay                     | word order                                                                                 |
| Bay — Wild            | wild bay                       | word order; see flagged items — the owner's other "wild" names read as a gene, not a shade |
| Chestnut — Medium     | red chestnut                   | portrait match q269                                                                        |
| Chestnut — Dark       | dark chestnut / liver chestnut | SPLIT: portrait match q269 uses both pictures for this one shade                           |
| Chestnut — Light      | light yellow chestnut          | portrait file is "lightchestnut"; confirm                                                  |
| Chestnut — Golden     | golden chestnut                | word order                                                                                 |
| Black — Standard      | nonfading black                | shown as plain "Black"                                                                     |
| Black — Faded         | fading black                   |                                                                                            |
| Palomino — Golden     | golden palomino                | word order                                                                                 |
| Palomino — Pale       | light palomino                 | portrait match q269                                                                        |
| Palomino — Copper     | dark palomino                  | portrait match q269                                                                        |
| Palomino — Chocolate  | chocolate palomino             | word order                                                                                 |
| Buckskin — Golden     | golden buckskin                | word order                                                                                 |
| Buckskin — Burnished  | classic buckskin               | portrait match q269                                                                        |
| Buckskin — Cream      | buttermilk buckskin            | portrait match q269                                                                        |
| Seal Brown — Dark     | dark seal brown                | word order                                                                                 |
| Seal Brown — Light    | light seal brown               | word order                                                                                 |
| Seal Brown — Sealskin | sealskin                       | owner name drops "seal brown"                                                              |

## C. Game names with no owner equivalent

Report only. Nothing here is deleted without the owner.

| Game name                          | Breeds | What it is                                                                                                                                                           |
| ---------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Amber Cream Dun Champagne          | 11     | bay + one cream + dun + champagne                                                                                                                                    |
| Classic Cream Dun Champagne        | 11     | black + one cream + dun + champagne                                                                                                                                  |
| Gold Cream Dun Champagne           | 11     | chestnut + one cream + dun + champagne                                                                                                                               |
| Ivory Dun Champagne                | 11     | champagne + two cream (or cream + pearl) + dun                                                                                                                       |
| Sable Cream Dun Champagne          | 0      | seal brown + one cream + dun + champagne                                                                                                                             |
| Seal Brown Dunskin                 | 0      | seal brown + one cream + dun                                                                                                                                         |
| Seal Brown Pearl Cream             | 0      | seal brown + one cream + one pearl; the owner list has no seal version of buckskin pearl (see flagged items)                                                         |
| Seal Brown Roan                    | 0      | seal brown + roan                                                                                                                                                    |
| Silver Amber Cream Champagne       | 4      |                                                                                                                                                                      |
| Silver Amber Cream Dun Champagne   | 4      |                                                                                                                                                                      |
| Silver Amber Dun Champagne         | 4      |                                                                                                                                                                      |
| Silver Classic Cream Champagne     | 4      |                                                                                                                                                                      |
| Silver Classic Cream Dun Champagne | 4      |                                                                                                                                                                      |
| Silver Classic Dun Champagne       | 4      |                                                                                                                                                                      |
| Silver Dapple Grulla               | 14     | black + one cream + dun + silver (a silver smoky grulla); owner has only silver grulla                                                                               |
| Silver Ivory Champagne             | 4      |                                                                                                                                                                      |
| Silver Ivory Dun Champagne         | 4      |                                                                                                                                                                      |
| Silver Sable Cream Champagne       | 0      |                                                                                                                                                                      |
| Silver Sable Cream Dun Champagne   | 0      |                                                                                                                                                                      |
| Silver Sable Dun Champagne         | 0      |                                                                                                                                                                      |
| Silver Seal Brown Dun              | 0      |                                                                                                                                                                      |
| Smoky Seal Brown                   | 1      | seal brown + one cream; the owner's snowdrop/sunshine entries imply she calls this "seal buckskin", but plain "seal buckskin" is not on her list (see flagged items) |
| Blanket                            | 20     | leopard complex + pattern 1 (one of eight names)                                                                                                                     |
| Leopard                            | 20     |                                                                                                                                                                      |
| Heavy Snowflake Leopard            | 20     |                                                                                                                                                                      |
| Light Snowflake Leopard            | 20     |                                                                                                                                                                      |
| Moderate Snowflake Leopard         | 20     |                                                                                                                                                                      |
| Heavy Frost Roan Varnish           | 20     |                                                                                                                                                                      |
| Light Frost Roan Varnish           | 20     |                                                                                                                                                                      |
| Moderate Frost Roan Varnish        | 20     |                                                                                                                                                                      |
| Varnish Roan                       | 20     | leopard complex without pattern 1 (one of three names)                                                                                                               |
| Fewspot Leopard                    | 20     |                                                                                                                                                                      |
| Snowcap                            | 20     |                                                                                                                                                                      |
| Brindle                            | 1      | brindle gene; replaces the whole color name, mares only                                                                                                              |
| Unknown                            | 0      | fallback when a horse has no color genotype on record; not a color                                                                                                   |

Shade words with no owner equivalent (the color itself may be in A or B):

| Color                   | Shade words with no owner equivalent                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Smoky Black             | faded, rich chocolate                                                                                                                                                                                     |
| Cremello                | ice, peachy                                                                                                                                                                                               |
| Perlino                 | cream, peachy                                                                                                                                                                                             |
| Smoky Cream             | light cream, dark cream                                                                                                                                                                                   |
| Gold Champagne          | pale, golden, dark, rich                                                                                                                                                                                  |
| Amber Champagne         | light, medium, deep, dark (standard shows no shade)                                                                                                                                                       |
| Classic Champagne       | faded, rich, light, dark (standard shows no shade)                                                                                                                                                        |
| Gold Cream Champagne    | pale, golden, burnished                                                                                                                                                                                   |
| Amber Cream Champagne   | light, rich, dark                                                                                                                                                                                         |
| Classic Cream Champagne | light, silver, charcoal                                                                                                                                                                                   |
| Gold Dun Champagne      | light, golden, red                                                                                                                                                                                        |
| Amber Dun Champagne     | light, tan, burnished                                                                                                                                                                                     |
| Classic Dun Champagne   | cool gray, iron, smoky                                                                                                                                                                                    |
| Bay Dun                 | light, dark (standard shows no shade)                                                                                                                                                                     |
| Red Dun                 | strawberry, medium, dark red                                                                                                                                                                              |
| Grulla                  | silver gray, burnished (standard shows no shade)                                                                                                                                                          |
| Blue Roan               | steel, cool gray, charcoal                                                                                                                                                                                |
| Red Roan                | rose, cherry, rust                                                                                                                                                                                        |
| Silver Bay              | light, brushed bronze, burnished                                                                                                                                                                          |
| Silver Grulla           | icy, gunmetal, shadow                                                                                                                                                                                     |
| Bay Pearl               | apricot, dark brown points                                                                                                                                                                                |
| Buckskin Pearl          | light apricot, reddish-brown points                                                                                                                                                                       |
| Smoky Black Pearl       | pale tan, dark points                                                                                                                                                                                     |
| the six gray names      | one shade each that repeats the name (e.g. "Fleabitten Gray — Fleabitten", "White Gray — White Gray")                                                                                                     |
| Dominant White          | white ("Dominant White — White")                                                                                                                                                                          |
| the appaloosa names     | light/mottled/spotted blanket; light spotted, freckled, bold spotted; heavy/light/moderate snowflake; heavy/light/moderate frost; roan wash, peppered, faded; porcelain, frosted; cream, porcelain, ivory |

## D. Owner names the game cannot produce or name

What it needs:

- **Shade only:** a new shade of a color the game has; no gene work.
- **Existing genes, name only:** the game already rolls the genotype, but the
  name calculation drops a part (roan, pearl, dun or silver) or hides it.
- **Existing markings flag, name only:** sooty, flaxen and pangare exist as
  markings flags; the owner's names put them in the color name.
- **Existing gene, unused:** the mushroom gene exists, but only plain
  chestnut is named and no breed file carries the gene.
- **New allele, existing gene:** a new version of a gene the game already has.
- **New gene:** a gene the game does not have.

| Owner name                                                                                           | What it needs                     | Detail                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| amber champagne pearl                                                                                | Existing genes, name only         | champagne + pearl (no cream): the name drops pearl                                                                                                |
| bay dun roan                                                                                         | Existing genes, name only         | roan is applied but the name collapses to Bay/Red/Blue Roan                                                                                       |
| bay pearl dun                                                                                        | Existing genes, name only         | two pearl + dun: the name keeps only the pearl part                                                                                               |
| black pearl dun                                                                                      | Existing genes, name only         | two pearl + dun: the name keeps only the pearl part                                                                                               |
| black pearl roan                                                                                     | Existing genes, name only         | roan is applied but hidden: the name stays e.g. "Perlino" and the roan flag is not shown                                                          |
| buckskin roan                                                                                        | Existing genes, name only         | roan is applied but the name collapses to Bay/Red/Blue Roan                                                                                       |
| chestnut pearl dun                                                                                   | Existing genes, name only         | two pearl + dun: the name keeps only the pearl part                                                                                               |
| chestnut pearl roan                                                                                  | Existing genes, name only         | roan is applied but hidden: the name stays e.g. "Perlino" and the roan flag is not shown                                                          |
| classic champagne pearl                                                                              | Existing genes, name only         | champagne + pearl (no cream): the name drops pearl                                                                                                |
| classic champagne roan                                                                               | Existing genes, name only         | roan is applied but hidden: the name stays e.g. "Perlino" and the roan flag is not shown                                                          |
| compound dominant white or maximum dominant white (W5/W20, W10/W20, W22/W20, W32/W35, etc.)          | New allele, existing gene         | two different dominant-white alleles in one horse: today every breed forbids or never rolls two copies, and W5, W32, W35 do not exist             |
| copper buckskin                                                                                      | Shade only                        | a new shade of an existing color                                                                                                                  |
| cremello dun                                                                                         | Existing genes, name only         | two cream + dun: the name drops dun                                                                                                               |
| cremello pearl                                                                                       | Existing genes, name only         | two cream + pearl: the name drops pearl (in real horses cream and pearl share one gene, so two cream + pearl is three copies — see flagged items) |
| dominant white sabino or spotted dominant white (W5, W10, W13, W19, W22, W31, W32, W35 heterozygous) | New allele, existing gene         | one copy of a "spotting" white allele shown differently from full dominant white; W10 and W22 exist, W5, W13, W19, W31, W32, W35 do not           |
| flaxen dark chestnut                                                                                 | Existing markings flag, name only | flaxen flag (chestnuts only) + chestnut shade; flaxen shows under markings, not in the color name                                                 |
| flaxen golden chestnut                                                                               | Existing markings flag, name only | flaxen flag (chestnuts only) + chestnut shade; flaxen shows under markings, not in the color name                                                 |
| flaxen light chestnut                                                                                | Existing markings flag, name only | flaxen flag (chestnuts only) + chestnut shade; flaxen shows under markings, not in the color name                                                 |
| flaxen red chestnut                                                                                  | Existing markings flag, name only | flaxen flag (chestnuts only) + chestnut shade; flaxen shows under markings, not in the color name                                                 |
| gold champagne pearl champagne                                                                       | Existing genes, name only         | champagne + pearl (no cream): the name drops pearl                                                                                                |
| grulla roan                                                                                          | Existing genes, name only         | roan is applied but the name collapses to Bay/Red/Blue Roan                                                                                       |
| honey bay                                                                                            | Shade only                        | a new shade of an existing color                                                                                                                  |
| isabella palomino                                                                                    | Shade only                        | a new shade of an existing color                                                                                                                  |
| mushroom amber champagne                                                                             | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom bay                                                                                         | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom bay dun                                                                                     | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom bay pearl                                                                                   | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom bay roan                                                                                    | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom black                                                                                       | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom buckskin                                                                                    | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom chestnut pearl                                                                              | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom cream pearl                                                                                 | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom cremello pearl                                                                              | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom gold champagne                                                                              | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom palomino                                                                                    | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom perlino pearl                                                                               | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom red dun                                                                                     | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom red roan                                                                                    | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom seal brown                                                                                  | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| mushroom smoky black                                                                                 | Existing gene, unused             | the mushroom gene exists, but only plain chestnut gets the name and no breed carries the gene                                                     |
| palomino roan                                                                                        | Existing genes, name only         | roan is applied but the name collapses to Bay/Red/Blue Roan                                                                                       |
| pangare bay                                                                                          | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare black                                                                                        | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare black pearl                                                                                  | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare buckskin                                                                                     | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare chestnut                                                                                     | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare chestnut pearl                                                                               | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare classic champagne                                                                            | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare gold champagne                                                                               | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare palomino                                                                                     | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| pangare perlino                                                                                      | Existing markings flag, name only | pangare flag; shows under markings, not in the color name                                                                                         |
| perlino dun                                                                                          | Existing genes, name only         | two cream + dun: the name drops dun                                                                                                               |
| perlino pearl                                                                                        | Existing genes, name only         | two cream + pearl: the name drops pearl (in real horses cream and pearl share one gene, so two cream + pearl is three copies — see flagged items) |
| perlino roan                                                                                         | Existing genes, name only         | roan is applied but hidden: the name stays e.g. "Perlino" and the roan flag is not shown                                                          |
| red dun roan                                                                                         | Existing genes, name only         | roan is applied but the name collapses to Bay/Red/Blue Roan                                                                                       |
| sable champagne pearl                                                                                | Existing genes, name only         | champagne + pearl (no cream): the name drops pearl                                                                                                |
| seal pearl dun                                                                                       | Existing genes, name only         | two pearl + dun: the name keeps only the pearl part                                                                                               |
| seal perlino pearl                                                                                   | Existing genes, name only         | two cream + pearl: the name drops pearl (in real horses cream and pearl share one gene, so two cream + pearl is three copies — see flagged items) |
| silver bay pearl                                                                                     | Existing genes, name only         | silver + two pearl: the name drops silver                                                                                                         |
| silver black pearl                                                                                   | Existing genes, name only         | silver + two pearl: the name drops silver                                                                                                         |
| silver buckskin                                                                                      | Existing genes, name only         | silver on a bay or cream horse: the name drops silver                                                                                             |
| silver dunskin                                                                                       | Existing genes, name only         | silver on a bay or cream horse: the name drops silver                                                                                             |
| silver perlino                                                                                       | Existing genes, name only         | silver on a bay or cream horse: the name drops silver                                                                                             |
| silver smoky cream                                                                                   | Existing genes, name only         | silver on a bay or cream horse: the name drops silver                                                                                             |
| smoky cream dun                                                                                      | Existing genes, name only         | two cream + dun: the name drops dun                                                                                                               |
| smoky cream pearl                                                                                    | Existing genes, name only         | two cream + pearl: the name drops pearl (in real horses cream and pearl share one gene, so two cream + pearl is three copies — see flagged items) |
| sooty smoky cream pearl                                                                              | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| snowdrop bay                                                                                         | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop bay pearl                                                                                   | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop black                                                                                       | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop black pearl                                                                                 | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop buckskin                                                                                    | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop chestnut                                                                                    | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop chestnut pearl                                                                              | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop palomino                                                                                    | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop seal                                                                                        | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop seal buckskin                                                                               | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop seal pearl                                                                                  | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop smoky black                                                                                 | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop sunshine black                                                                              | New gene                          | one snowdrop + one sunshine copy together                                                                                                         |
| snowdrop sunshine chestnut                                                                           | New gene                          | one snowdrop + one sunshine copy together                                                                                                         |
| snowdrop sunshine bay                                                                                | New gene                          | one snowdrop + one sunshine copy together                                                                                                         |
| snowdrop sunshine seal                                                                               | New gene                          | one snowdrop + one sunshine copy together                                                                                                         |
| snowdrop sunshine wild bay                                                                           | New gene                          | one snowdrop + one sunshine copy together                                                                                                         |
| snowdrop wild bay                                                                                    | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop wild bay pearl                                                                              | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| snowdrop wild buckskin                                                                               | New gene                          | new snowdrop dilution gene (the wild names also need the wild bay allele)                                                                         |
| sooty bay                                                                                            | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty black                                                                                          | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty black pearl                                                                                    | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty buckskin                                                                                       | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty classic champagne                                                                              | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty chestnut                                                                                       | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty chestnut pearl                                                                                 | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty palomino                                                                                       | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty perlino                                                                                        | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sooty smoky black pearl                                                                              | Existing markings flag, name only | sooty flag; shows under markings, not in the color name (sooty smoky cream pearl also needs the two-cream + pearl name above)                     |
| sunshine bay                                                                                         | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine bay pearl                                                                                   | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine black                                                                                       | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine black pearl                                                                                 | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine buckskin                                                                                    | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine chestnut                                                                                    | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine chestnut pearl                                                                              | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine palomino                                                                                    | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine seal                                                                                        | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine seal buckskin                                                                               | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine seal pearl                                                                                  | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine smoky black                                                                                 | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine wild bay                                                                                    | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine wild bay pearl                                                                              | New gene                          | new sunshine dilution gene                                                                                                                        |
| sunshine wild buckskin                                                                               | New gene                          | new sunshine dilution gene                                                                                                                        |
| wild amber champagne                                                                                 | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild amber champagne pearl                                                                           | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild amber cream champagne pearl                                                                     | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild bay pearl                                                                                       | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild buckskin                                                                                        | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild buckskin pearl                                                                                  | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild cream champagne                                                                                 | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild cream pearl                                                                                     | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild perlino                                                                                         | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| wild perlino pearl                                                                                   | New allele, existing gene         | needs a "wild bay" allele of the agouti gene (today "wild" exists only as a Bay shade)                                                            |
| yellow dun                                                                                           | Ambiguous                         | usually another word for bay dun (sometimes dunskin); the game has Bay Dun and Dunskin already                                                    |

## Flagged items in the owner list

1. **Duplicate:** "sooty smoky cream pearl" appears twice.
2. **"gold champagne pearl champagne"** says champagne twice. Its siblings are
   "amber champagne pearl", "classic champagne pearl" and "sable champagne
   pearl", so it probably means "gold champagne pearl".
3. **"gold cream pearl"** lacks "champagne". Its siblings are "amber / classic /
   sable cream pearl champagne", so it probably means "gold cream pearl
   champagne" (mapped that way in B).
4. **"seal" vs "seal brown":** the owner writes "seal" in seal pearl, seal
   dun, seal pearl dun, silver seal and the snowdrop/sunshine names, but "seal
   brown" in dark, light and standard seal brown and mushroom seal brown.
   Confirm they are the same color and which word the game shows.
5. **"seal buckskin"** appears only inside snowdrop and sunshine names. Plain
   seal buckskin (the game's Smoky Seal Brown) is not on the list. Add it, or
   drop that color?
6. **Pearl placement:** "amber champagne pearl" puts pearl after champagne;
   "amber cream pearl champagne" puts it before. Both forms are used for the
   same family. Confirm the order is intended.
7. **Dominant white, three entries:** plain "dominant white"; "compound
   dominant white or maximum dominant white (W5/W20, W10/W20, W22/W20,
   W32/W35, etc.)"; "dominant white sabino or spotted dominant white (W5,
   W10, W13, W19, W22, W31, W32, W35 heterozygous)". Each long entry holds
   two names (which one shows?) and ends in "etc." or an allele list. Needed:
   which alleles give plain dominant white, the full allele list for each
   entry, and where the game's existing W3, W4 and W20 belong (W20 is in the
   compound list but not the spotted list).
8. **Two cream copies plus pearl** ("cremello pearl", "perlino pearl", "smoky
   cream pearl", "seal perlino pearl", the mushroom and sooty versions): in
   real horses cream and pearl are versions of one gene, so a horse carries
   only two copies in total and these cannot exist. The game keeps them as
   separate genes, so it could make them. Keep them?
9. **Mushroom on black** ("mushroom black", "mushroom smoky black"): in real
   horses mushroom changes only red pigment, so these look like black and
   smoky black. Keep them as named colors?
10. **Names with no base color:** "mushroom cream pearl", "wild cream pearl"
    and "wild cream champagne" do not say which base. "wild cream pearl" may
    be "wild buckskin pearl", which is already on the list.
11. **"wild bay":** the game has "wild" only as a Bay shade. The owner's other
    wild names (wild buckskin, wild perlino, wild amber champagne...) read as
    a gene. Is wild bay a shade or a gene?
12. **"light yellow chestnut"** is the only "yellow" chestnut; the portrait is
    named lightchestnut and the flaxen form is "flaxen light chestnut".
    Confirm the name.
13. **"dark chestnut" and "liver chestnut"** both exist; the game has one dark
    chestnut shade and the portrait match uses both pictures for it. Split
    into two shades?
14. **"yellow dun"** is usually another word for bay dun (sometimes dunskin).
    What is it here?
15. **No plain base names:** the list has no plain bay, black, chestnut,
    palomino, buckskin or grey; they appear as standard bay, nonfading black,
    standard chestnut, classic palomino, classic buckskin and the grey
    variants. Confirm plain Palomino and plain Buckskin should become classic
    palomino and classic buckskin, and plain Gray should become dapple grey.
16. **Ivory Champagne** is not on the list, though the owner supplied an Ivory
    Champagne portrait on 2026-10-29.
17. **Not on the list at all:** the appaloosa names (Blanket, Leopard,
    Snowcap...), Brindle, seal roan, the champagne + cream + dun colors and
    the silver + cream champagne colors. Keep, rename or remove?

## New genes and alleles the owner list needs

- **Snowdrop** (new dilution gene): 15 names, plus 5 snowdrop-sunshine names.
- **Sunshine** (new dilution gene): 15 names, plus the 5 shared above.
- **Wild bay** (new version of the existing bay/black gene): 10 names, plus
  the snowdrop and sunshine wild names.
- **More dominant-white versions:** W5, W13, W19, W31, W32 and W35 do not
  exist (W3, W4, W10, W20 and W22 do), and no breed allows two different
  dominant-white versions in one horse today.
- **Mushroom** exists but needs breed odds and names beyond plain chestnut
  (17 names).
- **Sooty, flaxen and pangare** exist as random markings flags, not genes.
  Putting them in the color name needs no new gene, unless the owner wants
  them inherited as real genes.
- **Already present, name work only:** silver, pearl, roan, gray, dun, cream,
  champagne.

## Other findings for Equoria-7woyj

- **Shade entries the game never uses.** Breed files list shades under names
  the calculation never produces, so those shades never show: "Black Pearl"
  (12 breeds), "Chestnut Pearl" (12), "Palomino Pearl" (11), "Silver Black"
  (16), "Silver Buckskin" (4), "Strawberry Roan" (120) and "Sparse Mane/Tail"
  (312). The first five already use the owner's names; renaming the game
  names to the owner's names brings them to life.
- **Hidden roan.** Roan on a champagne, pearl or two-cream horse sets a roan
  flag the player never sees; the name stays e.g. "Perlino".
- **One-copy pseudo dun.** The calculation treats nd1/nd2 as dun, so 308
  breeds can roll Bay Dun, Red Dun and Grulla. In real horses nd1/nd2 is not
  dun. This is an odds question for the owner, not a rename.
- **Seal brown is one breed.** Only American Saddlebred can roll seal brown,
  so most seal and sable names (and every snowdrop or sunshine seal name)
  need breed odds as well as a name.
- **Gray shades repeat the name:** e.g. "Fleabitten Gray — Fleabitten",
  "White Gray — White Gray".
