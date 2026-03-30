# Section 11: Button Hierarchy, Feedback & UX Patterns

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** UX consistency (applies across all pages)
**Source:** UX Spec lines 1739-1910

---

## Button Hierarchy

### Primary Action (Gold)

- **The ONE thing we most want the player to do on this screen**
- Visual: Gold gradient bg (`--gold-primary` → `--gold-light`), Cinzel font, horseshoe border arcs
- Usage: "Enter Competition", "Confirm Breeding", "Train Now", "Hire Groom"
- **Rule: Maximum ONE primary button per screen**

### Secondary Action (Frosted Glass)

- Important but not the main goal
- Visual: Transparent + `--glass-border`, Inter font, gold text
- Hover: glass brightens, subtle gold glow
- Usage: "View Details", "Scout Field", "Compare Stats"

### Tertiary Action (Text Only)

- Supporting actions, navigation, dismissals
- Visual: Gold text link, no background, underline on hover
- Usage: "Cancel", "Skip", "Show all 23 disciplines"

### Destructive Action (Red)

- Irreversible or high-consequence
- Visual: Red-tinted glass bg, white text, confirmation dialog ALWAYS required
- **Rule: NEVER as primary button**
- Usage: "Sell Horse", "Fire Groom"

### Disabled State

- 40% opacity, no hover, `cursor: not-allowed`
- **ALWAYS show tooltip explaining WHY** ("Horse is on cooldown — ready March 14")

---

## Feedback Patterns — Tiered by Significance

### Routine Success (No toast)

- Training complete, groom interaction done
- Subtle counter increment in header + brief inline confirmation
- **No toast for routine actions**

### Meaningful Success (RewardToast)

- XP threshold crossed (25/50/75%), level up, first-time achievement
- Slide-in toast, 3 seconds, auto-dismiss

### Lifetime Milestone (CinematicMoment)

- First-ever win, first foal, first trait discovery of each type
- Full cinematic overlay. Scales after 5th occurrence.
- **NEVER for routine wins** — players enter hundreds of shows

### Error Handling

- API failure: ErrorCard (friendly message, retry, alternatives). Never raw error codes.
- Validation: Inline red text below field. Explains what's wrong AND how to fix.
- Offline: Persistent banner "You appear to be offline" + cached state.
- **Every error must suggest a next step**

### Warning

- Amber-bordered frosted card + warning icon
- Usage: high inbreeding, selling horse with foals, groom retirement
- **Warnings NEVER block the action** — they inform, player decides

---

## Form Patterns

### Input Fields

- Frosted glass border, `--text-primary` text, gold focus ring
- Label ABOVE field (never placeholder-only)
- Validation on blur (not every keystroke). Green checkmark on valid.
- Error: inline below field, red text, how to fix

### Selection Controls

- Radio groups (breed, gender): Visual cards with gold border on selected
- Checkboxes: Gold checkmark, frosted glass
- Dropdowns: Dark glass, gold hover. shadcn Select restyled.

### Form Submission

- Primary CTA at bottom. Disabled until valid.
- Loading: GallopingLoader inline (tiny), text → "Saving..."
- Success: inline confirmation or navigation, not just a toast
- Error: scroll to first error field, focus it

### Naming Pattern (horse, club naming)

- Real-time character count ("12/50")
- Uniqueness check on blur
- Forbidden character stripping
- Preview in Cinzel font at display size

---

## Empty States

Every empty state includes: (1) friendly message, (2) CTA to fill it, (3) Celestial Night visual.

| Context      | Message                         | CTA                      | Visual              |
| ------------ | ------------------------------- | ------------------------ | ------------------- |
| No horses    | "Your stable is waiting"        | "Choose starter horse"   | Horse silhouette    |
| No results   | "No results yet"                | "Browse open shows"      | Trophy silhouette   |
| No foals     | "Breeding journey hasn't begun" | "Explore breeding"       | Foal silhouette     |
| No grooms    | "Hire a groom"                  | "Visit hiring board"     | Groom silhouette    |
| Search empty | "No matches found"              | "Adjust filters" + clear | Magnifying glass    |
| No messages  | "Inbox is empty"                | "Visit community"        | Envelope silhouette |

---

## Loading States

| Context            | Pattern                     | Visual                     |
| ------------------ | --------------------------- | -------------------------- |
| Page load          | GallopingLoader centered    | Animated horse silhouette  |
| Component load     | SkeletonCard matching shape | Horse-shaped skeletons     |
| Action in progress | Button inline mini-loader   | "Saving...", disabled      |
| Data refresh       | Subtle opacity pulse        | Current data stays visible |

**Rule:** Loading should NEVER be blank. Always show structure or animation.

## Implementation Checklist

- [ ] Define button variant classes (gold/glass/ghost/destructive/disabled)
- [ ] Enforce one-primary-per-screen rule
- [ ] Add disabled tooltip pattern
- [ ] Implement tiered feedback (no toast → toast → cinematic)
- [ ] Update ErrorCard with alternatives suggestion
- [ ] Update form inputs with gold focus ring + label-above pattern
- [ ] Add character count to naming inputs
- [ ] Audit all empty states against the table above
- [ ] Verify loading states use skeletons/galloping horse
