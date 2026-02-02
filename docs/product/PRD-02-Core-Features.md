# PRD-02: Core Features - User & Horse Management

**Version:** 1.0.0
**Last Updated:** 2025-11-07
**Status:** Backend ✅ Implemented | Frontend ❌ Pending

---

## 1. User Management System

### 1.1 Authentication & Account Management (P0)
**Status:** ✅ Fully Implemented (Backend)

**Requirements:**
- User registration with email/password
- Secure JWT-based authentication with refresh tokens
- Password reset and email verification
- Role-based access control (User, Moderator, Admin)
- Profile management (avatar, display name, bio)
- Account settings and preferences

**Technical Specifications:**
- bcrypt password hashing with 10+ salt rounds
- JWT access tokens (15-minute expiry) and refresh tokens (7-day expiry)
- PostgreSQL users table with UUID primary keys
- JSONB settings field for flexible preferences
- Rate limiting on authentication endpoints (5 attempts per 15 minutes)

**Acceptance Criteria:**
- Users can register and log in securely
- Password requirements enforced (8+ characters, complexity)
- JWT tokens properly validated on protected endpoints
- User sessions persist across app restarts
- Account recovery flow functional

**Implementation Files:**
- Backend: [/backend/controllers/authController.mjs](../../backend/controllers/authController.mjs)
- Routes: [/backend/routes/authRoutes.mjs](../../backend/routes/authRoutes.mjs)
- Tests: 100% coverage for auth flows

---

### 1.2 User Progression System (P0)
**Status:** ✅ Backend Implemented | ❌ Frontend UI Needed

**Requirements:**
- User level system (starting at level 1)
- Experience points (XP) system with level progression
- In-game currency (money) management
- Progress tracking with percentage calculations
- XP event logging for transparency
- Dashboard with comprehensive user statistics

**Game Mechanics:**
- **Level 1:** 0-199 XP required
- **Level 2+:** 100 XP per level (Level 2 = 100-199 XP, Level 3 = 200-299 XP, etc.)
- **Starting Money:** $1,000 default
- **XP Sources:** Training (+5 XP), Competition wins (+10-20 XP), Breeding activities (+15 XP)

**Level Formula:**
```
Current Level = Math.floor(totalXP / 100) + 1
XP for Next Level = (currentLevel * 100)
Progress % = ((totalXP % 100) / 100) * 100
```

**Technical Specifications:**
- Real-time progress API with level thresholds
- XP events table for complete audit trail
- Money transaction validation (no negative balances)
- Dashboard API aggregating horses, shows, recent activity

**API Endpoints:**
- `GET /api/users/:id/progress` - Get user level/XP progress
- `GET /api/users/dashboard` - Comprehensive user dashboard
- `POST /api/users/:id/award-xp` - Award XP for activities
- `GET /api/users/:id/xp-history` - Get XP history log

**Acceptance Criteria:**
- XP properly awarded for all activities
- Level-up notifications triggered correctly
- Progress bars accurate and performant
- Money transactions validated and logged
- Dashboard loads in <500ms with all user data

---

## 2. Horse Management System

### 2.1 Horse CRUD Operations (P0)
**Status:** ✅ Backend Implemented | ❌ Frontend UI Needed

**Requirements:**
- Create new horses with full attribute definition
- View horse details with complete statistics
- Update horse information and attributes
- Delete horses with cascade relationship cleanup
- List horses with filtering and pagination
- Horse search by name, breed, attributes

**Horse Attributes:**
- **Basic Info:** Name (2-50 characters), age (0-30 years), gender (Mare/Stallion/Gelding)
- **Breed Information:** Breed assignment with characteristics
- **Core Stats (0-100 scale):**
  - Speed, Stamina, Agility, Balance, Precision
  - Intelligence, Boldness, Flexibility, Obedience, Focus
- **Discipline Scores (0-100+ scale):** 23 disciplines with individual progress tracking
- **Genetic Data:** JSONB epigenetic modifiers (positive/negative/hidden traits)
- **Status:** Health status, training cooldown, burnout state
- **Financial:** Total earnings, sale price, stud fee (for stallions)
- **Relationships:** Owner (user), stable assignment, parent tracking (sire/dam)

**Technical Specifications:**
- PostgreSQL horses table with JSONB for flexible data
- Comprehensive validation at API and database layers
- Indexed queries for performance (owner_id, breed_id, training_cooldown)
- Cascade deletes for competition results and training logs
- Support for both UUID users and legacy integer user IDs

**API Endpoints:**
- `POST /api/horses` - Create new horse
- `GET /api/horses/:id` - Get horse details
- `PUT /api/horses/:id` - Update horse
- `DELETE /api/horses/:id` - Delete horse
- `GET /api/horses/user/:userId` - List user's horses
- `GET /api/horses/search` - Search horses

**Acceptance Criteria:**
- CRUD operations functional with proper validation
- Horse lists paginated (20 per page default)
- Filtering by age, breed, gender, owner functional
- Search returns results in <200ms for 10,000+ horses
- All relationships properly maintained on updates/deletes

---

### 2.2 Horse XP & Stat Progression System (P0)
**Status:** ✅ Backend Implemented | ❌ Frontend UI Needed

**Requirements:**
- Horses earn XP from competition participation
- XP converts to stat points for strategic allocation
- Complete XP history tracking with audit trail
- Player-controlled stat point distribution
- Independent from user XP system

**Game Mechanics:**
- **XP to Stat Conversion:** 100 Horse XP = 1 allocable stat point
- **Competition XP Awards:**
  - 1st Place: 30 XP (20 base + 10 placement bonus)
  - 2nd Place: 27 XP (20 base + 7 placement bonus)
  - 3rd Place: 25 XP (20 base + 5 placement bonus)
  - 4th+: 20 XP (no placement bonus)
- **Stat Allocation:** Player chooses which stat to increase (Speed, Stamina, Agility, etc.)
- **Allocation Limit:** 1 point per allocation request
- **Strategic Purpose:** Allows specialization of horses for specific disciplines

**XP Calculation Formula:**
```javascript
baseXP = 20
placementBonus = placement === 1 ? 10 :
                 placement === 2 ? 7 :
                 placement === 3 ? 5 : 0
totalHorseXP = baseXP + placementBonus
availableStatPoints = Math.floor(horse.totalXP / 100)
```

**Technical Specifications:**
- Horse XP stored in horses table
- HorseXPEvent table for complete history
- Stat allocation validation (prevents over-allocation)
- API endpoints for XP status, allocation, and history
- Integration with competition result processing

**API Endpoints:**
- `GET /api/horses/:id/xp` - Get horse XP status and available stat points
- `POST /api/horses/:id/allocate-stat` - Allocate stat points to horse stats
- `GET /api/horses/:id/xp-history` - Get paginated horse XP history
- `POST /api/horses/:id/award-xp` - Award XP to horses (admin/system)

**Acceptance Criteria:**
- XP properly awarded based on competition placement
- Stat points correctly calculated (total XP ÷ 100)
- Stat allocation immediately reflected in horse stats
- XP history provides complete audit trail
- System prevents negative XP or invalid allocations

---

## 3. Horse Conformation and Physical Attributes

### 3.1 Conformation Scoring System (P1)
**Status:** ⚠️ Backend Support | ❌ Not Fully Documented

**Requirements:**
- 8 body region scoring (0-100 scale per region)
- Breed-specific scoring adjustments
- Conformation show integration
- Visual representation of conformation
- Breeding value assessment

**Conformation Regions:**
1. **Head:** Structure, refinement, expression (0-100)
2. **Neck:** Length, shape, carriage quality (0-100)
3. **Shoulders:** Angle, slope, muscling (0-100)
4. **Back:** Strength, length, topline (0-100)
5. **Legs:** Structure, correctness, soundness (0-100)
6. **Hooves:** Size, shape, quality (0-100)
7. **Topline:** Muscle definition, condition (0-100)
8. **Hindquarters:** Power, structure, engagement (0-100)

**Overall Conformation Score:**
```
Overall Score = Average of all 8 region scores
Breed Modifier = Breed-specific adjustments (±10%)
Final Score = (Overall Score) × (1 + Breed Modifier)
```

**Technical Specifications:**
- `horses.conformationScores` JSONB field
- Conformation calculation service
- Breed-specific modifiers in breed definitions
- Integration with conformation show scoring

**API Endpoints:**
- `GET /api/horses/:id/conformation` - Get conformation breakdown
- `POST /api/horses/:id/conformation/update` - Update conformation scores
- `GET /api/horses/:id/conformation/analysis` - Get detailed analysis

---

### 3.2 Gait Quality System (P2)
**Status:** ❌ Planned Feature

**Requirements:**
- 5 gait quality ratings (Walk, Trot, Canter, Gallop, Special)
- Quality scoring (0-100 per gait)
- Gait improvement through training
- Discipline-specific gait importance
- Irregularity flagging system

**Gait Types:**
1. **Walk:** Rhythm, stride length, quality (0-100)
2. **Trot:** Extension, suspension, balance (0-100)
3. **Canter:** Collection, balance, rhythm (0-100)
4. **Gallop:** Speed, efficiency, stamina (0-100)
5. **Special Gait:** Breed-specific (Gaited horses only) (0-100)

**Gait Features:**
- Quality ratings improve with discipline training
- Gait irregularities flag potential health issues
- Discipline bonuses based on gait quality
- Breed-specific gait natural strengths

**Technical Specifications:**
- `horses.gaitScores` JSONB field (planned)
- Gait training service (planned)
- Integration with training system

---

### 3.3 Visual Appearance System (P2)
**Status:** ❌ Planned Feature

**Requirements:**
- Coat color genotype system
- Face markings (blaze, star, strip, snip)
- Leg markings (stockings, socks, coronet)
- Image/portrait rendering based on genotype
- Appearance inheritance in breeding

**Coat Color Genetics:**
- Base colors: Bay, Black, Chestnut
- Modifiers: Cream, Dun, Roan
- Patterns: Tobiano, Overo, Appaloosa
- Realistic inheritance following genetic rules

**Visual Features:**
- Face markings with multiple types
- Leg markings with variation
- Coat sheen and condition indicators
- Dynamic image generation based on attributes

---

## Cross-References

- **Previous:** [PRD-01-Overview.md](./PRD-01-Overview.md)
- **Next:** [PRD-03-Gameplay-Systems.md](./PRD-03-Gameplay-Systems.md)
- **Advanced Systems:** [PRD-04-Advanced-Systems.md](./PRD-04-Advanced-Systems.md)
- **Technical Documentation:** [docs/index.md](../index.md)
- **API Contracts:** [api-contracts-backend.md](../api-contracts-backend.md)
- **Data Models:** [data-models.md](../data-models.md)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-07 | Initial breakdown - User and Horse Management |
| 1.0.1 | 2025-12-01 | Updated cross-references to existing documentation |

