# Equoria - Technical Stack Documentation

## Document Control
- **Version:** 1.0.0
- **Last Updated:** 2025-11-07
- **Project Status:** Advanced Backend Development, Frontend Planning
- **Technical Lead:** Development Team

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Technology Stack Overview](#technology-stack-overview)
3. [Backend Technologies](#backend-technologies)
4. [Frontend Technologies](#frontend-technologies)
5. [Database and Data Storage](#database-and-data-storage)
6. [Development Tools](#development-tools)
7. [Testing and Quality Assurance](#testing-and-quality-assurance)
8. [Security and Authentication](#security-and-authentication)
9. [DevOps and Deployment](#devops-and-deployment)
10. [Performance and Monitoring](#performance-and-monitoring)
11. [Third-Party Services](#third-party-services)
12. [Architecture Decisions](#architecture-decisions)
13. [Dependency Management](#dependency-management)

---

## Executive Summary

Equoria is built on a modern, production-ready technology stack designed for scalability, maintainability, and performance. The architecture follows industry best practices with a clear separation between backend (Node.js/Express/PostgreSQL) and frontend (React Native/Expo).

### Technology Philosophy
- **Modern JavaScript:** ES6+ with ES Modules throughout
- **Type Safety:** Prisma ORM for type-safe database operations
- **Testing Excellence:** 468+ comprehensive tests with 90.1% success rate using balanced mocking
- **Security First:** Enterprise-grade authentication, validation, and protection
- **Developer Experience:** Fast iteration, comprehensive documentation, clear patterns
- **Production Ready:** Battle-tested technologies with strong ecosystem support

### Key Technology Choices

| Category | Technology | Version | Justification |
|----------|-----------|---------|---------------|
| **Backend Runtime** | Node.js | 18+ | Excellent async I/O, massive ecosystem, ES module support |
| **Backend Framework** | Express.js | 4.x | Battle-tested, lightweight, extensive middleware ecosystem |
| **Database** | PostgreSQL | 14+ | JSONB support for flexible game data, ACID compliance, excellent performance |
| **ORM** | Prisma | Latest | Type safety, excellent migrations, modern developer experience |
| **Frontend Framework** | React Native | 0.76+ | Cross-platform iOS/Android, large ecosystem, hot reload |
| **Frontend Platform** | Expo | Latest | Simplified RN development, OTA updates, managed services |
| **Testing Framework** | Jest | 29.x | Comprehensive testing, ES module support, excellent mocking |
| **Authentication** | JWT | 9.x | Stateless, scalable, industry standard |
| **Styling** | Tailwind CSS | 4.x | Utility-first, consistent design, browser-optimized |

---

## Technology Stack Overview

### Full Stack Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (WEB BROWSER)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │        React Native 0.76+ with Expo SDK              │  │
│  │  - Tailwind CSS (NativeWind) for styling            │  │
│  │  - React Navigation 6.x for routing                 │  │
│  │  - Redux Toolkit / Zustand for state               │  │
│  │  - Axios for HTTP requests                          │  │
│  │  - AsyncStorage for local persistence              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/JSON
                              │
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (BACKEND)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Node.js 18+ with Express.js 4.x           │  │
│  │  - JWT Authentication (jsonwebtoken 9.x)            │  │
│  │  - Validation (express-validator 7.x)               │  │
│  │  - Security (helmet 7.x, cors, rate-limit)          │  │
│  │  - Logging (winston 3.x)                            │  │
│  │  - Cron Jobs (node-cron 4.x)                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Prisma ORM
                              │
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER (DATABASE)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PostgreSQL 14+ Database                 │  │
│  │  - JSONB for flexible game data                     │  │
│  │  - GIN indexes for JSONB queries                    │  │
│  │  - Connection pooling                               │  │
│  │  - Automated backups                                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Layers

#### Presentation Layer (Frontend)
- **Web App:** React + Vite
- **Styling:** Tailwind CSS via NativeWind
- **Navigation:** React Navigation
- **State Management:** Redux Toolkit / Zustand
- **Forms:** React Hook Form
- **Data Fetching:** Axios + React Query

#### Business Logic Layer (Backend)
- **API Server:** Express.js
- **Authentication:** JWT + bcrypt
- **Validation:** express-validator
- **Game Logic:** Custom JavaScript modules
- **Scheduled Tasks:** node-cron

#### Data Layer (Database)
- **Primary Database:** PostgreSQL
- **ORM:** Prisma
- **Caching:** Redis (planned)
- **File Storage:** AWS S3 or similar (planned)

---

## Backend Technologies

### Core Backend Stack

#### Node.js 18+ LTS
**Purpose:** JavaScript runtime for backend server

**Key Features:**
- Modern ES module support
- Excellent async/await and Promise handling
- Large package ecosystem (npm)
- Strong performance for I/O-bound operations
- Built-in crypto for security operations

**Version:** 18.x or later
**Installation:**
```bash
# Recommended: Use nvm for Node.js version management
nvm install 18
nvm use 18
```

**Configuration:**
- ES Modules enabled via `"type": "module"` in package.json
- All files use .mjs extension for clarity
- Experimental VM modules for Jest testing

**Why Node.js:**
- Excellent for real-time game backend operations
- Single language (JavaScript) for frontend and backend
- Non-blocking I/O ideal for concurrent game operations
- Massive ecosystem of tested packages

---

#### Express.js 4.18+
**Purpose:** Web framework for RESTful API

**Key Features:**
- Lightweight and unopinionated
- Robust routing system
- Excellent middleware ecosystem
- Easy integration with authentication, validation, logging
- Strong community support

**Version:** ^4.18.2
**Installation:**
```bash
npm install express@^4.18.2
```

**Express Middleware Stack:**
1. **helmet** - Security headers (CSP, HSTS, XSS protection)
2. **cors** - Cross-origin resource sharing
3. **compression** - Response compression (gzip)
4. **express.json()** - JSON body parsing
5. **express-rate-limit** - API rate limiting
6. **Custom auth middleware** - JWT validation
7. **express-validator** - Request validation
8. **Winston logger** - Request/response logging
9. **Error handler** - Centralized error handling

**Routing Architecture:**
```javascript
// Routes organized by feature
/api/auth/*          - Authentication endpoints
/api/users/*         - User management
/api/horses/*        - Horse CRUD operations
/api/training/*      - Training system
/api/competition/*   - Competition system
/api/breeding/*      - Breeding and foals
/api/traits/*        - Trait discovery
/api/grooms/*        - Groom management
/api/dashboard/*     - User dashboard
```

**Why Express:**
- Industry standard for Node.js APIs
- Flexible and lightweight
- Excellent middleware support
- Easy to test and maintain
- Clear separation of concerns

---

### Backend Dependencies

#### Production Dependencies

**Core Framework:**
```json
{
  "express": "^4.18.2",
  "dotenv": "^16.5.0",
  "compression": "^1.8.1"
}
```

**Security:**
```json
{
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.1.5",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2"
}
```

**Validation and Parsing:**
```json
{
  "express-validator": "^7.0.1"
}
```

**Database and ORM:**
```json
{
  "pg": "^8.16.0",
  "@prisma/client": "Latest (generated)"
}
```

**Logging and Monitoring:**
```json
{
  "winston": "^3.11.0"
}
```

**Scheduled Tasks:**
```json
{
  "node-cron": "^4.2.1"
}
```

**Caching (Planned):**
```json
{
  "ioredis": "^5.7.0"
}
```

**Documentation:**
```json
{
  "swagger-ui-express": "^5.0.1",
  "yamljs": "^0.3.0"
}
```

---

#### Development Dependencies

**Testing:**
```json
{
  "jest": "^29.7.0",
  "@jest/globals": "^29.7.0",
  "supertest": "^7.0.0"
}
```

**Code Quality:**
```json
{
  "eslint": "^8.57.0",
  "@eslint/js": "^9.28.0",
  "prettier": "^3.3.2"
}
```

**Development Server:**
```json
{
  "nodemon": "^3.1.4"
}
```

**Code Coverage:**
```json
{
  "c8": "^8.0.1",
  "nyc": "^15.1.0",
  "codecov": "^3.8.3"
}
```

---

### Backend Architecture Patterns

#### Layered Architecture

**Routes Layer (`/routes`):**
- API endpoint definitions
- HTTP method mapping (GET, POST, PUT, DELETE)
- Route-level validation
- Middleware application

Example:
```javascript
// trainingRoutes.mjs
import express from 'express';
import { body } from 'express-validator';
import { auth } from '../middleware/auth.mjs';
import * as trainingController from '../controllers/trainingController.mjs';

const router = express.Router();

router.post('/train',
  auth,
  body('horseId').isInt(),
  body('discipline').isString(),
  trainingController.trainHorse
);

export default router;
```

**Controllers Layer (`/controllers`):**
- Business logic orchestration
- Request validation
- Response formatting
- Error handling

Example:
```javascript
// trainingController.mjs
export async function trainHorse(req, res, next) {
  try {
    const { horseId, discipline } = req.body;

    // Validate eligibility
    const eligible = await checkEligibility(horseId, discipline);
    if (!eligible) {
      return res.status(400).json({ success: false, error: 'Not eligible' });
    }

    // Perform training
    const result = await trainingModel.executeTrain(horseId, discipline);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
```

**Models Layer (`/models`):**
- Database operations via Prisma
- Data validation
- Query optimization
- Transaction management

Example:
```javascript
// trainingModel.mjs
import prisma from '../db/prismaClient.mjs';

export async function executeTrain(horseId, discipline) {
  return await prisma.$transaction(async (tx) => {
    // Update discipline score
    const horse = await tx.horse.update({
      where: { id: horseId },
      data: {
        disciplineScores: {
          [discipline]: { increment: 5 }
        },
        trainingCooldown: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    // Log training session
    await tx.trainingLog.create({
      data: { horseId, discipline, trainedAt: new Date() }
    });

    return horse;
  });
}
```

**Utils Layer (`/utils`):**
- Game mechanics calculations
- Helper functions
- Pure functions (no database access)
- Reusable logic

Example:
```javascript
// traitEffects.mjs
export function calculateTraitEffects(traits) {
  let xpModifier = 1.0;
  let stressModifier = 1.0;

  if (traits.positive.includes('intelligent')) {
    xpModifier += 0.25;
  }
  if (traits.negative.includes('nervous')) {
    stressModifier += 0.25;
  }

  return { xpModifier, stressModifier };
}
```

**Middleware Layer (`/middleware`):**
- Cross-cutting concerns
- Authentication and authorization
- Request logging
- Error handling
- Validation

Example:
```javascript
// auth.mjs
import jwt from 'jsonwebtoken';

export function auth(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```

---

### Backend File Structure

```
backend/
├── server.mjs                    # Server entry point
├── package.json                  # Dependencies and scripts
├── .env                          # Environment variables (not in git)
├── .env.example                  # Example environment variables
│
├── controllers/                  # Business logic layer
│   ├── authController.mjs
│   ├── horseController.mjs
│   ├── trainingController.mjs
│   ├── competitionController.mjs
│   ├── breedingController.mjs
│   ├── traitController.mjs
│   └── groomController.mjs
│
├── models/                       # Data access layer
│   ├── userModel.mjs
│   ├── horseModel.mjs
│   ├── trainingModel.mjs
│   ├── competitionModel.mjs
│   ├── breedingModel.mjs
│   └── groomModel.mjs
│
├── routes/                       # API route definitions
│   ├── authRoutes.mjs
│   ├── horseRoutes.mjs
│   ├── trainingRoutes.mjs
│   ├── competitionRoutes.mjs
│   ├── breedingRoutes.mjs
│   ├── traitRoutes.mjs
│   ├── groomRoutes.mjs
│   └── ping.mjs
│
├── utils/                        # Helper functions and game logic
│   ├── statMap.mjs              # Discipline stat mappings
│   ├── trainingCooldown.mjs     # Cooldown calculations
│   ├── isHorseEligible.mjs      # Eligibility checking
│   ├── competitionScoring.mjs   # Competition scoring algorithm
│   ├── genetics.mjs             # Genetic inheritance logic
│   ├── traitEffects.mjs         # Trait effect calculations
│   └── levelCalculation.mjs     # Horse level calculation
│
├── logic/                        # Complex game mechanics
│   ├── trainingLogic.mjs
│   ├── competitionLogic.mjs
│   ├── breedingLogic.mjs
│   ├── traitDiscovery.mjs
│   └── milestoneEvaluator.mjs
│
├── middleware/                   # Express middleware
│   ├── auth.mjs                 # JWT authentication
│   ├── errorHandler.mjs         # Global error handling
│   ├── validatePing.mjs         # Health check validation
│   └── rateLimiter.mjs          # Rate limiting config
│
├── errors/                       # Custom error classes
│   ├── AppError.mjs
│   ├── ValidationError.mjs
│   ├── AuthorizationError.mjs
│   ├── NotFoundError.mjs
│   └── DatabaseError.mjs
│
├── services/                     # External services and integrations
│   ├── cronJobs.mjs             # Scheduled tasks (salary payments)
│   └── logger.mjs               # Winston logger configuration
│
├── db/                           # Database connection
│   └── prismaClient.mjs         # Prisma client instance
│
├── seed/                         # Database seeding scripts
│   ├── seedDatabase.mjs
│   ├── seedShows.mjs
│   └── seedBreeds.mjs
│
├── scripts/                      # Utility scripts
│   ├── migrate.mjs              # Database migrations
│   ├── health-check.mjs         # Health check script
│   └── checkData.mjs            # Data validation
│
├── tests/                        # Test files (468+ tests)
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   ├── api/                     # API endpoint tests
│   └── helpers/                 # Test helpers and fixtures
│
├── docs/                         # API documentation
│   └── swagger.mjs              # Swagger/OpenAPI spec
│
└── coverage/                     # Test coverage reports
    └── lcov-report/             # HTML coverage report
```

---

## Frontend Technologies

### Core Frontend Stack

#### React Native 0.76+
**Purpose:** Modern web application framework

**Key Features:**
- Single codebase for iOS and Android
- Native performance and look-and-feel
- Hot reload for fast development
- Large ecosystem of packages
- Strong community support

**Version:** ^0.76.9
**Installation:**
```bash
npm install react-native@^0.76.9
```

**Why React Native:**
- Cross-platform development reduces costs
- JavaScript skills leveraged from backend
- Optimized performance for web browser games
- Excellent developer experience with hot reload
- Large ecosystem of pre-built components

---

#### Expo SDK
**Purpose:** Simplified React Native development platform

**Key Features:**
- Managed build service
- Over-the-air (OTA) updates
- Push notifications
- Pre-configured native modules
- Easy device testing
- Simplified deployment

**Version:** Latest SDK
**Installation:**
```bash
npx create-expo-app@latest
```

**Expo Services Used:**
- **Expo Go:** Development client for testing
- **EAS Build:** Cloud-based iOS/Android builds
- **EAS Update:** OTA updates for non-native changes
- **Expo Notifications:** Push notification service
- **Expo SecureStore:** Encrypted local storage for tokens

**Why Expo:**
- Dramatically simplifies React Native setup
- Removes need for Xcode/Android Studio for most work
- OTA updates for rapid bug fixes
- Managed native dependencies
- Excellent documentation

---

### Frontend Dependencies

#### Production Dependencies

**Core Framework:**
```json
{
  "react": "^19.1.0",
  "react-native": "^0.76.9",
  "expo": "~latest"
}
```

**Navigation:**
```json
{
  "react-navigation": "^6.x",
  "@react-navigation/native": "^6.x",
  "@react-navigation/bottom-tabs": "^6.x",
  "@react-navigation/stack": "^6.x"
}
```

**State Management:**
```json
{
  "redux": "^5.x",
  "@reduxjs/toolkit": "^2.x",
  "react-redux": "^9.x",
  "zustand": "^4.x"
}
```

**Data Fetching:**
```json
{
  "@tanstack/react-query": "^5.0.0",
  "axios": "^1.6.0"
}
```

**Forms:**
```json
{
  "react-hook-form": "^7.x",
  "yup": "^1.x"
}
```

**UI Components:**
```json
{
  "react-native-paper": "^5.x",
  "react-native-vector-icons": "^10.x"
}
```

**Styling:**
```json
{
  "nativewind": "^4.x",
  "tailwindcss": "^4.1.8",
  "tailwindcss-animate": "^1.0.7"
}
```

**Local Storage:**
```json
{
  "@react-native-async-storage/async-storage": "^2.2.0"
}
```

**Animations:**
```json
{
  "react-native-reanimated": "~3.x",
  "react-native-gesture-handler": "~2.x"
}
```

**Utilities:**
```json
{
  "date-fns": "^3.x",
  "lodash": "^4.17.21"
}
```

---

#### Development Dependencies

**Testing:**
```json
{
  "@testing-library/react-native": "^13.3.3",
  "@testing-library/jest-dom": "^6.8.0",
  "@testing-library/user-event": "^14.5.0",
  "react-test-renderer": "^19.1.1"
}
```

**Code Quality:**
```json
{
  "eslint": "^8.57.0",
  "eslint-plugin-react": "^7.x",
  "eslint-plugin-react-native": "^4.x",
  "prettier": "^3.3.2"
}
```

**Type Checking:**
```json
{
  "typescript": "^5.3.0",
  "@types/react": "^18.3.24",
  "@types/react-native": "^0.73.0"
}
```

---

### Frontend Architecture

#### Component Structure

**Component Hierarchy:**
```
App
├── Navigation (React Navigation)
│   ├── Auth Stack (Login, Register)
│   └── Main Tabs
│       ├── Stable Tab (Stack)
│       │   ├── StableOverviewScreen
│       │   ├── HorseListScreen
│       │   └── HorseDetailScreen
│       │       ├── StatsTab
│       │       ├── TrainingTab
│       │       ├── CompetitionTab
│       │       └── BreedingTab
│       ├── Training Tab (Stack)
│       │   ├── TrainingOverviewScreen
│       │   ├── DisciplineSelectScreen
│       │   └── TrainingSessionScreen
│       ├── Competition Tab (Stack)
│       │   ├── CompetitionScheduleScreen
│       │   ├── ShowDetailScreen
│       │   └── ResultsScreen
│       ├── Breeding Tab (Stack)
│       │   ├── BreedingOverviewScreen
│       │   ├── BreedingPairScreen
│       │   └── FoalManagementScreen
│       └── Profile Tab (Stack)
│           ├── ProfileDashboardScreen
│           ├── ProgressScreen
│           └── SettingsScreen
```

**Component Types:**
1. **Screens:** Full-screen views
2. **Containers:** Data-fetching wrappers
3. **Components:** Reusable UI elements
4. **Elements:** Atomic UI pieces (buttons, inputs, text)

**Component Example:**
```javascript
// HorseCard.jsx
import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';

export function HorseCard({ horse, onPress }) {
  return (
    <TouchableOpacity
      className="bg-white rounded-lg p-4 mb-3 shadow-md"
      onPress={onPress}
    >
      <View className="flex-row items-center">
        <Image
          source={{ uri: horse.imageUrl }}
          className="w-16 h-16 rounded-full"
        />
        <View className="ml-4 flex-1">
          <Text className="text-lg font-bold">{horse.name}</Text>
          <Text className="text-gray-600">{horse.breed} • {horse.age} years</Text>
          <Text className="text-sm text-gray-500">Level {horse.level}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
```

---

#### State Management Strategy

**Global State (Redux Toolkit or Zustand):**
- User authentication state
- User profile data
- App settings and preferences
- Cached horse list
- Navigation state

**Server State (React Query):**
- API data caching
- Background refetching
- Optimistic updates
- Pagination support
- Automatic cache invalidation

**Local State (useState):**
- Form inputs
- UI toggles
- Temporary selections
- Modal visibility

**Persistent State (AsyncStorage):**
- JWT access and refresh tokens
- User preferences
- Offline data
- Draft content

**Example State Management:**
```javascript
// Using Redux Toolkit
import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false
  },
  reducers: {
    login: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    }
  }
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
```

---

### Frontend File Structure

```
frontend/
├── App.js                        # App entry point
├── package.json                  # Dependencies and scripts
├── app.json                      # Expo configuration
├── babel.config.js               # Babel configuration
├── tailwind.config.js            # Tailwind CSS configuration
│
├── src/
│   ├── navigation/               # Navigation configuration
│   │   ├── AppNavigator.jsx
│   │   ├── AuthNavigator.jsx
│   │   └── MainTabNavigator.jsx
│   │
│   ├── screens/                  # Screen components
│   │   ├── auth/
│   │   │   ├── LoginScreen.jsx
│   │   │   └── RegisterScreen.jsx
│   │   ├── stable/
│   │   │   ├── StableOverviewScreen.jsx
│   │   │   ├── HorseListScreen.jsx
│   │   │   └── HorseDetailScreen.jsx
│   │   ├── training/
│   │   │   ├── TrainingOverviewScreen.jsx
│   │   │   └── TrainingSessionScreen.jsx
│   │   ├── competition/
│   │   │   ├── CompetitionScheduleScreen.jsx
│   │   │   └── ResultsScreen.jsx
│   │   ├── breeding/
│   │   │   ├── BreedingOverviewScreen.jsx
│   │   │   └── FoalManagementScreen.jsx
│   │   └── profile/
│   │       ├── ProfileDashboardScreen.jsx
│   │       └── SettingsScreen.jsx
│   │
│   ├── components/               # Reusable components
│   │   ├── common/
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Card.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   ├── horse/
│   │   │   ├── HorseCard.jsx
│   │   │   ├── HorseList.jsx
│   │   │   └── StatBar.jsx
│   │   ├── training/
│   │   │   ├── DisciplineGrid.jsx
│   │   │   └── TrainingTimer.jsx
│   │   └── breeding/
│   │       ├── FoalDevelopmentTab.jsx
│   │       └── TraitDisplay.jsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.js
│   │   ├── useHorses.js
│   │   ├── useTraining.js
│   │   └── useCompetition.js
│   │
│   ├── services/                 # API service layer
│   │   ├── api.js               # Axios instance configuration
│   │   ├── authService.js
│   │   ├── horseService.js
│   │   ├── trainingService.js
│   │   └── competitionService.js
│   │
│   ├── store/                    # State management
│   │   ├── store.js             # Redux store configuration
│   │   ├── slices/
│   │   │   ├── authSlice.js
│   │   │   ├── horseSlice.js
│   │   │   └── settingsSlice.js
│   │   └── queries/
│   │       ├── horseQueries.js  # React Query queries
│   │       └── trainingQueries.js
│   │
│   ├── utils/                    # Utility functions
│   │   ├── formatters.js        # Date, currency, stat formatters
│   │   ├── validators.js        # Form validation
│   │   └── constants.js         # App constants
│   │
│   ├── styles/                   # Global styles
│   │   └── theme.js             # Theme configuration
│   │
│   └── assets/                   # Static assets
│       ├── images/
│       ├── icons/
│       └── fonts/
│
└── __tests__/                    # Test files
    ├── components/
    ├── screens/
    └── utils/
```

---

## Database and Data Storage

### PostgreSQL 14+

**Purpose:** Primary relational database for all persistent data

**Key Features:**
- ACID compliance for data integrity
- JSONB support for flexible game data
- Excellent performance with proper indexing
- Robust query optimizer
- Strong ecosystem and tooling

**Version:** 14+ (latest stable recommended)
**Installation:**
```bash
# macOS (Homebrew)
brew install postgresql@14

# Ubuntu/Debian
sudo apt-get install postgresql-14

# Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:14
```

**Configuration:**
```bash
# .env file
DATABASE_URL="postgresql://username:password@localhost:5432/equoria_dev?schema=public"
```

**Why PostgreSQL:**
- JSONB perfect for flexible game data (traits, genetics, settings)
- Excellent performance with large data sets
- ACID guarantees for financial transactions
- Robust indexing including GIN indexes for JSONB
- Mature, battle-tested technology
- Free and open-source

---

### Prisma ORM

**Purpose:** Type-safe database ORM and migrations

**Key Features:**
- Type-safe database access
- Auto-generated TypeScript types
- Declarative data modeling
- Database migrations
- Query optimization
- Excellent developer experience

**Version:** Latest
**Installation:**
```bash
npm install prisma --save-dev
npm install @prisma/client
```

**Schema Example:**
```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  password  String
  money     Int      @default(1000)
  level     Int      @default(1)
  xp        Int      @default(0)
  settings  Json     @default("{}")
  horses    Horse[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Horse {
  id                  Int      @id @default(autoincrement())
  name                String
  age                 Int
  gender              String
  breedId             Int
  userId              String
  disciplineScores    Json     @default("{}")
  epigeneticModifiers Json     @default("{}")
  trainingCooldown    DateTime?
  speed               Int      @default(0)
  stamina             Int      @default(0)
  agility             Int      @default(0)
  balance             Int      @default(0)
  precision           Int      @default(0)
  intelligence        Int      @default(0)
  boldness            Int      @default(0)
  flexibility         Int      @default(0)
  obedience           Int      @default(0)
  focus               Int      @default(0)
  totalEarnings       Int      @default(0)
  healthStatus        String   @default("Healthy")
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user                User     @relation(fields: [userId], references: [id])
  breed               Breed    @relation(fields: [breedId], references: [id])
  trainingLogs        TrainingLog[]
  competitionResults  CompetitionResult[]

  @@map("horses")
  @@index([userId])
  @@index([trainingCooldown])
}
```

**Prisma Client Usage:**
```javascript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Type-safe queries
const horses = await prisma.horse.findMany({
  where: {
    userId: user.id,
    age: { gte: 3 }
  },
  include: {
    breed: true,
    trainingLogs: {
      take: 10,
      orderBy: { trainedAt: 'desc' }
    }
  }
});

// Transactions
await prisma.$transaction(async (tx) => {
  const horse = await tx.horse.update({
    where: { id: horseId },
    data: {
      disciplineScores: { Racing: 30 },
      trainingCooldown: newDate
    }
  });

  await tx.trainingLog.create({
    data: { horseId, discipline: 'Racing' }
  });
});
```

**Migrations:**
```bash
# Create new migration
npx prisma migrate dev --name add_grooms_table

# Apply migrations to production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# View database in Prisma Studio
npx prisma studio
```

**Why Prisma:**
- Type safety eliminates entire class of bugs
- Migrations handle schema evolution cleanly
- Excellent developer experience with auto-completion
- Optimized queries with relation loading
- Works seamlessly with PostgreSQL JSONB
- Great documentation and community

---

### Database Schema Overview

**Core Tables:**
- **users:** User accounts (UUID PKs, JSONB settings)
- **horses:** Horse entities (10 stats, JSONB disciplines/traits)
- **breeds:** Horse breed definitions
- **foals:** Foal development (JSONB genetics/traits)
- **shows:** Competition events
- **competition_results:** Competition history
- **training_logs:** Training session history
- **grooms:** Professional groom staff
- **groom_assignments:** Groom-to-horse assignments
- **groom_interactions:** Groom activity logging
- **trait_history_logs:** Trait development tracking
- **xp_events:** XP award audit trail
- **horse_xp_events:** Horse XP award audit trail

**JSONB Fields Usage:**
- **users.settings:** User preferences (notifications, privacy, theme)
- **horses.disciplineScores:** Training progress per discipline
- **horses.epigeneticModifiers:** Trait arrays (positive, negative, hidden)
- **foals.genetics:** Genetic allele pairs (dominant/recessive)
- **foals.traits:** Discovered traits during development

**Indexing Strategy:**
- Primary keys (automatic)
- Foreign keys (automatic)
- Training cooldown timestamp
- Competition results (horse_id, show_id, run_date)
- GIN indexes for JSONB fields (traits, genetics, settings)
- User email (unique constraint)

---

### Redis (Planned for Caching)

**Purpose:** In-memory caching for performance optimization

**Planned Use Cases:**
- Session storage
- API response caching
- Leaderboard caching
- Frequently accessed horse data
- Training cooldown status

**Version:** 7.x
**Why Redis:**
- Sub-millisecond latency
- Reduces database load
- TTL support for automatic expiration
- Sorted sets for leaderboards
- Pub/sub for real-time features

---

## Development Tools

### Code Editor and IDE

**Recommended: Visual Studio Code**
- Excellent JavaScript/TypeScript support
- Rich extension ecosystem
- Integrated terminal and debugging
- Git integration
- ESLint and Prettier integration

**Essential VS Code Extensions:**
- ESLint
- Prettier - Code formatter
- Prisma
- React Native Tools
- Jest Runner
- GitLens
- Path Intellisense

---

### Version Control

**Git with GitHub**
- Version control for all code
- Pull request workflow
- GitHub Actions for CI/CD
- Issue tracking
- Project boards

**Git Workflow:**
1. Feature branches from `main`
2. Pull requests for code review
3. Automated tests in CI
4. Merge to `main` after approval
5. Automatic deployment to staging/production

---

### Package Management

**npm (Node Package Manager)**
- Default Node.js package manager
- Version locking with package-lock.json
- Scripts for common tasks
- Security auditing

**Key npm Scripts:**
```json
{
  "scripts": {
    "start": "node server.mjs",
    "dev": "nodemon server.mjs",
    "test": "jest",
    "test:watch": "jest --watchAll",
    "test:coverage": "jest --coverage",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "migrate": "node scripts/migrate.mjs"
  }
}
```

---

### Documentation

**API Documentation: Swagger/OpenAPI 3.0**
- Interactive API documentation
- Automatic from code annotations
- Try-it-out functionality
- Schema validation

**Code Documentation: JSDoc**
- Inline code documentation
- Type hints for IDEs
- Auto-generated docs

---

## Testing and Quality Assurance

### Testing Framework: Jest 29.x

**Purpose:** Comprehensive testing for backend and frontend

**Key Features:**
- ES module support
- Snapshot testing
- Mocking capabilities
- Code coverage reporting
- Parallel test execution
- Watch mode for TDD

**Version:** ^29.7.0
**Configuration:**
```javascript
// jest.config.js
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.mjs'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85
    }
  }
};
```

**Test Structure:**
```javascript
// Example test file
import { describe, test, expect, beforeEach } from '@jest/globals';
import { calculateTraitEffects } from '../utils/traitEffects.mjs';

describe('Trait Effects Calculation', () => {
  test('should apply intelligent trait bonus', () => {
    const traits = { positive: ['intelligent'], negative: [] };
    const result = calculateTraitEffects(traits);

    expect(result.xpModifier).toBe(1.25);
  });

  test('should apply nervous trait penalty', () => {
    const traits = { positive: [], negative: ['nervous'] };
    const result = calculateTraitEffects(traits);

    expect(result.stressModifier).toBe(1.25);
  });
});
```

**Testing Philosophy:**
- **Balanced Mocking (84 files):** 90.1% success rate
- **Strategic Mocking:** Mock only external dependencies (database, HTTP, logger)
- **No Over-Mocking:** Test real business logic, not artificial mocks
- **Pure Functions:** 100% success rate with no mocking
- **Integration Tests:** Real database operations revealing actual issues

---

### Code Quality Tools

#### ESLint 8.57.0
**Purpose:** JavaScript linting and code quality

**Configuration:**
```javascript
// .eslintrc.json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off",
    "semi": ["error", "always"]
  }
}
```

---

#### Prettier 3.3.2
**Purpose:** Code formatting

**Configuration:**
```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

---

### Testing Stack Summary

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Testing Framework** | Jest 29.x | Unit, integration, API tests |
| **HTTP Testing** | Supertest 7.x | API endpoint testing |
| **React Native Testing** | Testing Library | Component testing |
| **Code Coverage** | Jest + c8 | Coverage reporting |
| **Linting** | ESLint 8.57 | Code quality |
| **Formatting** | Prettier 3.3 | Code formatting |

---

## Security and Authentication

### Authentication System

#### JWT (JSON Web Tokens) 9.0.2
**Purpose:** Stateless authentication

**Token Types:**
- **Access Token:** Short-lived (15 minutes), used for API requests
- **Refresh Token:** Long-lived (7 days), used to obtain new access tokens

**Implementation:**
```javascript
// Token generation
import jwt from 'jsonwebtoken';

const accessToken = jwt.sign(
  { userId: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);

const refreshToken = jwt.sign(
  { userId: user.id },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);

// Token verification
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

**Why JWT:**
- Stateless (no server-side session storage)
- Scalable (works with load balancers)
- Secure (signed and optionally encrypted)
- Standard (widely supported)

---

#### bcrypt 2.4.3
**Purpose:** Password hashing

**Features:**
- One-way hashing (cannot be reversed)
- Configurable salt rounds
- Slow by design (resistant to brute force)

**Implementation:**
```javascript
import bcrypt from 'bcryptjs';

// Hash password
const saltRounds = 10;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

**Why bcrypt:**
- Industry standard for password hashing
- Adaptive (can increase rounds as computers get faster)
- Salted automatically (prevents rainbow table attacks)
- Slow hashing deters brute force

---

### Security Libraries

#### helmet 7.1.0
**Purpose:** Security HTTP headers

**Headers Set:**
- Content Security Policy (CSP)
- X-Frame-Options (clickjacking protection)
- Strict-Transport-Security (HTTPS enforcement)
- X-Content-Type-Options (MIME sniffing protection)
- X-XSS-Protection

**Implementation:**
```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));
```

---

#### CORS (Cross-Origin Resource Sharing) 2.8.5
**Purpose:** Control cross-origin requests

**Configuration:**
```javascript
import cors from 'cors';

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true,
  optionsSuccessStatus: 200
}));
```

---

#### express-rate-limit 7.1.5
**Purpose:** API rate limiting

**Configuration:**
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.'
});

app.use('/api/auth/login', authLimiter);
```

---

### Input Validation

#### express-validator 7.0.1
**Purpose:** Request validation and sanitization

**Implementation:**
```javascript
import { body, validationResult } from 'express-validator';

app.post('/api/training/train',
  body('horseId').isInt({ min: 1 }),
  body('discipline').isString().trim().notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // Process valid request
  }
);
```

---

### Security Best Practices Summary

| Security Measure | Technology | Implementation |
|------------------|-----------|----------------|
| **Authentication** | JWT + bcrypt | Access + refresh tokens, hashed passwords |
| **Authorization** | Custom middleware | Role-based access control |
| **Headers** | helmet | CSP, XSS protection, HSTS |
| **CORS** | cors middleware | Origin whitelist |
| **Rate Limiting** | express-rate-limit | 100 req/15min general, 5/15min auth |
| **Input Validation** | express-validator | Schema validation on all endpoints |
| **SQL Injection** | Prisma ORM | Parameterized queries |
| **Secrets** | dotenv | Environment variables |
| **HTTPS** | Production config | TLS/SSL certificates |

---

## DevOps and Deployment

### Continuous Integration (CI)

**GitHub Actions**
- Automated testing on push/PR
- Linting and formatting checks
- Code coverage reporting
- Build verification

**Example Workflow:**
```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run test:coverage
```

---

### Continuous Deployment (CD)

**Deployment Targets:**
- **Backend:** AWS, Google Cloud, or Heroku
- **Database:** Managed PostgreSQL (RDS, Cloud SQL)
- **Frontend:** Apple App Store, Google Play Store

**Deployment Strategy:**
- Staging environment for pre-production testing
- Automated deployments from `main` branch
- Blue-green deployments for zero downtime
- Rollback capability

---

### Containerization

**Docker (Planned)**
- Consistent development and production environments
- Easy scaling
- Simplified deployment

**Example Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.mjs"]
```

---

### Monitoring and Logging

#### Winston 3.11.0
**Purpose:** Structured logging

**Configuration:**
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}
```

---

### Environment Management

**.env Files:**
```bash
# Development
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/equoria_dev
JWT_SECRET=dev_secret_key
JWT_REFRESH_SECRET=dev_refresh_secret

# Production (different secrets, managed database)
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@prod-host:5432/equoria_prod
JWT_SECRET=production_secret_key
JWT_REFRESH_SECRET=production_refresh_secret
```

---

## Performance and Monitoring

### Performance Optimization

**Backend:**
- Connection pooling (Prisma)
- Database indexing
- Query optimization
- Response compression (gzip)
- Caching (Redis planned)

**Frontend:**
- Code splitting
- Lazy loading
- Image optimization (FastImage)
- List virtualization (FlatList)
- Memoization (React.memo, useMemo)

---

### Monitoring Tools (Planned)

| Category | Tool | Purpose |
|----------|------|---------|
| **APM** | New Relic / Datadog | Application performance monitoring |
| **Error Tracking** | Sentry | Frontend crash reporting |
| **Logging** | CloudWatch / Papertrail | Centralized log aggregation |
| **Uptime** | Pingdom / StatusCake | Uptime monitoring |
| **Analytics** | Mixpanel / Amplitude | User behavior tracking |

---

## Third-Party Services

### Current Services

| Service | Purpose | Status |
|---------|---------|--------|
| **PostgreSQL** | Primary database | ✅ Implemented |
| **GitHub** | Version control, CI/CD | ✅ Implemented |
| **npm Registry** | Package management | ✅ Implemented |

### Planned Services

| Service | Purpose | Status |
|---------|---------|--------|
| **AWS S3** | Image storage | 📋 Planned |
| **Redis** | Caching | 📋 Planned |
| **Sentry** | Error tracking | 📋 Planned |
| **Mixpanel** | Analytics | 📋 Planned |
| **Stripe** | Payment processing | 📋 Planned |
| **SendGrid** | Email notifications | 📋 Planned |
| **Firebase Cloud Messaging** | Push notifications | 📋 Planned |

---

## Architecture Decisions

### Key Technical Decisions and Rationale

#### 1. ES Modules Over CommonJS
**Decision:** Use ES Modules (.mjs files) exclusively
**Rationale:**
- Modern JavaScript standard
- Better tree-shaking for smaller bundles
- Cleaner syntax
- Native browser support
- Future-proof

**Trade-offs:**
- Some legacy packages require CommonJS
- Testing requires experimental flags

---

#### 2. PostgreSQL Over MongoDB
**Decision:** PostgreSQL as primary database
**Rationale:**
- ACID compliance critical for game economy
- JSONB provides flexibility of NoSQL
- Complex relationships between horses, users, competitions
- Mature tooling and ecosystem
- Excellent performance with proper indexing

**Trade-offs:**
- Slightly more rigid schema
- Requires migrations for schema changes

---

#### 3. Prisma Over Sequelize
**Decision:** Prisma ORM instead of traditional ORMs
**Rationale:**
- Type safety eliminates entire class of bugs
- Excellent developer experience
- Modern, actively developed
- Great migration system
- Auto-generated types

**Trade-offs:**
- Newer technology (less mature)
- Some advanced PostgreSQL features require raw queries

---

#### 4. React Native Over Native Development
**Decision:** Cross-platform with React Native
**Rationale:**
- Single codebase reduces development time/cost
- JavaScript skills shared with backend
- Large ecosystem of packages
- Hot reload speeds development
- Expo simplifies deployment

**Trade-offs:**
- Slightly lower performance than native
- Some native modules require custom code
- Larger app bundle size

---

#### 5. JWT Over Session-Based Auth
**Decision:** JWT tokens for authentication
**Rationale:**
- Stateless (scales horizontally)
- No server-side session storage
- Works well with web applications
- Standard, widely supported

**Trade-offs:**
- Cannot invalidate tokens before expiry (addressed with short expiry + refresh)
- Slightly larger request size

---

#### 6. Balanced Mocking Testing Philosophy
**Decision:** Strategic mocking of external dependencies only
**Rationale:**
- 90.1% success rate vs 1% with over-mocking (mathematically proven)
- Tests validate real business logic
- Integration tests catch actual implementation gaps
- Pure functions tested without mocks achieve 100% success

**Trade-offs:**
- Slightly slower tests due to database operations
- Requires test database setup

---

## Dependency Management

### Dependency Update Strategy

**Regular Updates:**
- Security patches: Immediately
- Minor versions: Monthly
- Major versions: Quarterly (with testing)

**Security Auditing:**
```bash
# Audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Check outdated packages
npm outdated
```

---

### Key Dependency Versions

**Backend Production:**
```json
{
  "express": "^4.18.2",
  "pg": "^8.16.0",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.2",
  "helmet": "^7.1.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^7.1.5",
  "express-validator": "^7.0.1",
  "winston": "^3.11.0",
  "node-cron": "^4.2.1",
  "compression": "^1.8.1",
  "dotenv": "^16.5.0",
  "ioredis": "^5.7.0",
  "swagger-ui-express": "^5.0.1",
  "yamljs": "^0.3.0"
}
```

**Backend Development:**
```json
{
  "jest": "^29.7.0",
  "@jest/globals": "^29.7.0",
  "supertest": "^7.0.0",
  "eslint": "^8.57.0",
  "prettier": "^3.3.2",
  "nodemon": "^3.1.4",
  "c8": "^8.0.1"
}
```

**Frontend Production:**
```json
{
  "react": "^19.1.0",
  "react-native": "^0.76.9",
  "expo": "~latest",
  "@tanstack/react-query": "^5.0.0",
  "axios": "^1.6.0",
  "tailwindcss": "^4.1.8",
  "@react-native-async-storage/async-storage": "^2.2.0"
}
```

---

## DevOps and Continuous Integration

### Automated CI/CD Pipeline

#### GitHub Actions Workflow
**Status:** ✅ Fully Implemented
**Configuration:** `.github/workflows/ci.yml`

**9-Job Workflow System:**

```yaml
# Workflow Overview
name: Equoria CI/CD Pipeline

on: [push, pull_request]

jobs:
  # Job 1: Code Quality Validation
  code-quality:
    runs-on: ubuntu-latest
    steps:
      - Checkout code
      - Setup Node.js 18
      - Install dependencies
      - Run ESLint validation
      - Run Prettier format check
      - Report code quality metrics

  # Job 2: Database Setup and Migrations
  database-setup:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - Initialize PostgreSQL database
      - Run Prisma migrations
      - Verify schema integrity
      - Seed test data

  # Job 3: Backend Testing with Coverage
  backend-testing:
    runs-on: ubuntu-latest
    needs: database-setup
    steps:
      - Run Jest test suite (942+ tests)
      - Generate coverage reports
      - Upload coverage to Codecov
      - Verify coverage thresholds (80-90%)
      - Archive test results

  # Job 4: Integration Testing
  integration-testing:
    runs-on: ubuntu-latest
    needs: backend-testing
    steps:
      - Run 67 system-wide integration tests
      - Validate authentication flows
      - Test API response consistency
      - Verify memory management
      - Check health monitoring

  # Job 5: Performance Testing
  performance-testing:
    runs-on: ubuntu-latest
    needs: integration-testing
    steps:
      - Setup load testing environment
      - Simulate 100+ concurrent users
      - Monitor response times (P50, P95, P99)
      - Track memory usage and leaks
      - Verify throughput benchmarks
      - Generate performance reports

  # Job 6: Frontend Testing (Planned)
  frontend-testing:
    runs-on: ubuntu-latest
    steps:
      - Run component tests
      - Execute E2E tests
      - Verify UI rendering
      - Check accessibility compliance

  # Job 7: Security Scanning
  security-scanning:
    runs-on: ubuntu-latest
    steps:
      - Run npm audit for vulnerabilities
      - Check dependency licenses
      - Scan for security patterns
      - Verify authentication security
      - Generate security report

  # Job 8: Deployment Readiness
  deployment-readiness:
    runs-on: ubuntu-latest
    needs: [backend-testing, integration-testing]
    steps:
      - Build production bundle
      - Verify build artifacts
      - Check environment configuration
      - Validate database connections
      - Test deployment scripts

  # Job 9: Summary Reporting
  summary-reporting:
    runs-on: ubuntu-latest
    needs: [code-quality, backend-testing, integration-testing, performance-testing, security-scanning]
    if: always()
    steps:
      - Aggregate all job results
      - Generate comprehensive report
      - Post results to pull request
      - Notify team on failures
      - Update status badges
```

**Workflow Features:**
- **Parallel Execution:** Independent jobs run in parallel for speed
- **Job Dependencies:** Strategic dependencies ensure proper execution order
- **Conditional Execution:** Frontend tests skip if not implemented
- **Failure Handling:** Always() ensures summary runs even on failures
- **Caching:** Dependency caching speeds up workflow execution

---

### Test Coverage Reporting

#### Istanbul/nyc Integration
**Status:** ✅ Fully Implemented

**Configuration:**
```javascript
// .nycrc.json
{
  "all": true,
  "include": [
    "backend/**/*.mjs",
    "backend/**/*.js"
  ],
  "exclude": [
    "**/*.test.mjs",
    "**/*.spec.mjs",
    "**/node_modules/**",
    "**/coverage/**"
  ],
  "reporter": [
    "text",
    "text-summary",
    "html",
    "lcov",
    "json",
    "cobertura"
  ],
  "check-coverage": true,
  "branches": 80,
  "functions": 90,
  "lines": 85,
  "statements": 85,
  "per-file": true,
  "watermarks": {
    "lines": [80, 95],
    "functions": [85, 95],
    "branches": [75, 90],
    "statements": [80, 95]
  }
}
```

**Coverage Thresholds:**
- **Branches:** 80% minimum (critical decision paths)
- **Functions:** 90% minimum (all functions tested)
- **Lines:** 85% minimum (comprehensive code coverage)
- **Statements:** 85% minimum (execution path coverage)

**Report Formats:**
- **Text:** Console output with coverage summary
- **HTML:** Interactive browser-based coverage report
- **LCOV:** Industry-standard format for tools integration
- **JSON:** Machine-readable for parsing and analysis
- **Cobertura:** XML format for CI/CD integration

**Codecov Integration:**
```yaml
# .codecov.yml
codecov:
  require_ci_to_pass: yes
  notify:
    after_n_builds: 1

coverage:
  precision: 2
  round: down
  range: "70...100"

  status:
    project:
      default:
        target: 85%
        threshold: 2%
    patch:
      default:
        target: 80%

comment:
  layout: "reach, diff, flags, files"
  behavior: default
  require_changes: no
```

**Coverage Badge:**
```markdown
[![codecov](https://codecov.io/gh/username/equoria/branch/main/graph/badge.svg)](https://codecov.io/gh/username/equoria)
```

---

### Performance Regression Testing

#### Automated Performance Validation
**Status:** ✅ Implemented
**Tools:** Custom Node.js performance scripts

**Load Testing Configuration:**
```javascript
// scripts/performance-test.mjs
const loadTestConfig = {
  target: 'http://localhost:3000',
  phases: [
    { duration: '1m', arrivalRate: 10 },  // Warm-up: 10 users/sec
    { duration: '5m', arrivalRate: 50 },  // Normal load: 50 users/sec
    { duration: '2m', arrivalRate: 100 }, // Peak load: 100 users/sec
    { duration: '5m', arrivalRate: 50 },  // Cool-down: 50 users/sec
  ],
  scenarios: [
    {
      name: 'Authentication Flow',
      weight: 20,
      flow: [
        { post: '/api/auth/login', json: {...} },
        { get: '/api/users/profile' }
      ]
    },
    {
      name: 'Horse Management',
      weight: 30,
      flow: [
        { get: '/api/horses' },
        { get: '/api/horses/:id' },
        { get: '/api/horses/:id/xp' }
      ]
    },
    {
      name: 'Competition Entry',
      weight: 25,
      flow: [
        { get: '/api/competition/disciplines' },
        { post: '/api/competition/enter' },
        { post: '/api/competition/execute' }
      ]
    },
    {
      name: 'Training Session',
      weight: 25,
      flow: [
        { post: '/api/training/check-eligibility' },
        { post: '/api/training/train' },
        { get: '/api/training/status/:horseId' }
      ]
    }
  ]
};
```

**Performance Metrics Tracked:**
- **Response Time Percentiles:**
  - P50 (median): Target < 50ms
  - P95: Target < 100ms
  - P99: Target < 200ms
  - P99.9: Target < 500ms

- **Throughput:**
  - Requests per second (RPS): Target 1000+ RPS
  - Successful requests: Target 99.9%
  - Failed requests: Target < 0.1%

- **Resource Usage:**
  - CPU utilization: Target < 70% under peak load
  - Memory usage: Target < 80% of allocated
  - Database connections: Monitor pool usage
  - Network bandwidth: Track data transfer

**Performance Regression Detection:**
```javascript
// Baseline vs Current Comparison
const baselineMetrics = {
  p95ResponseTime: 95,
  p99ResponseTime: 180,
  throughput: 1200,
  errorRate: 0.08
};

function detectRegression(currentMetrics) {
  const regressionThreshold = 0.10; // 10% degradation

  const checks = {
    responseTime: (currentMetrics.p95 - baselineMetrics.p95ResponseTime) / baselineMetrics.p95ResponseTime,
    throughput: (baselineMetrics.throughput - currentMetrics.throughput) / baselineMetrics.throughput,
    errorRate: (currentMetrics.errorRate - baselineMetrics.errorRate) / baselineMetrics.errorRate
  };

  return Object.entries(checks)
    .filter(([metric, change]) => change > regressionThreshold)
    .map(([metric, change]) => ({
      metric,
      degradation: `${(change * 100).toFixed(2)}%`,
      severity: change > 0.25 ? 'critical' : 'warning'
    }));
}
```

**Automated Alerts:**
- Slack/Discord notification on regression detection
- GitHub issue creation for critical regressions
- Performance report attached to pull requests
- Trend analysis charts for long-term tracking

---

### Database Migration Testing

#### Migration Safety System
**Status:** ✅ Implemented

**Migration Test Suite:**
```javascript
// tests/migrations/migration-safety.test.mjs
describe('Database Migration Safety', () => {
  test('All migrations run forward successfully', async () => {
    await prisma.$executeRaw`DROP SCHEMA IF EXISTS test_migrations CASCADE`;
    await prisma.$executeRaw`CREATE SCHEMA test_migrations`;

    // Run all migrations forward
    const result = await runMigrations('up');
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('All migrations rollback successfully', async () => {
    // Run all migrations forward first
    await runMigrations('up');

    // Then rollback
    const result = await runMigrations('down');
    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('Data integrity maintained during migration', async () => {
    // Seed test data
    await seedTestData();

    // Run migration
    await runMigrations('up');

    // Verify data integrity
    const dataCheck = await verifyDataIntegrity();
    expect(dataCheck.corruptedRecords).toBe(0);
    expect(dataCheck.missingRecords).toBe(0);
  });

  test('Migration performance within acceptable limits', async () => {
    const startTime = Date.now();
    await runMigrations('up');
    const duration = Date.now() - startTime;

    // Migration should complete within 30 seconds
    expect(duration).toBeLessThan(30000);
  });

  test('Cross-environment compatibility', async () => {
    const environments = ['development', 'staging', 'production'];

    for (const env of environments) {
      const result = await testMigrationInEnvironment(env);
      expect(result.success).toBe(true);
    }
  });
});
```

**Migration Validation Checklist:**
- ✅ Forward migration succeeds without errors
- ✅ Rollback migration succeeds without errors
- ✅ Data integrity maintained (no data loss)
- ✅ Foreign key constraints properly handled
- ✅ Indexes created/dropped correctly
- ✅ Performance within acceptable limits
- ✅ Compatible across all environments
- ✅ Idempotent (can be run multiple times safely)

---

## Frontend Technology Stack

### React Native & Expo Framework

#### React Native 0.76+
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Modern web development

**Key Features:**
- **Single Codebase:** Write once, deploy to iOS and Android
- **Native Performance:** Direct compilation to native code
- **Hot Reload:** Instant code updates during development
- **Large Ecosystem:** 1000+ community packages
- **Strong Typing:** TypeScript support throughout

**Core Dependencies:**
```json
{
  "react": "^19.1.0",
  "react-native": "^0.76.9",
  "expo": "~latest",
  "expo-status-bar": "~latest"
}
```

#### Expo SDK
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Simplified React Native development

**Expo Services:**
- **Expo Go:** Development client for testing
- **EAS Build:** Cloud-based iOS/Android builds
- **EAS Update:** Over-the-air updates for non-native changes
- **Expo Notifications:** Push notification service
- **Expo SecureStore:** Encrypted local storage
- **Expo Router:** File-based routing system

**Why Expo:**
- Eliminates need for Xcode/Android Studio for most development
- OTA updates allow instant bug fixes without app store approval
- Managed build service simplifies deployment
- Pre-configured native modules reduce setup time

---

### State Management

#### Redux Toolkit (Primary Choice)
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Predictable global state management

**Key Features:**
- **Redux Toolkit:** Official, opinionated Redux with less boilerplate
- **RTK Query:** Powerful data fetching and caching
- **DevTools:** Time-travel debugging
- **Persistence:** State persistence across app restarts

**Configuration:**
```javascript
// store/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

import authReducer from './slices/authSlice';
import horseReducer from './slices/horseSlice';
import settingsReducer from './slices/settingsSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'settings']
};

export const store = configureStore({
  reducer: {
    auth: persistReducer(persistConfig, authReducer),
    horses: horseReducer,
    settings: settingsReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    })
});

export const persistor = persistStore(store);
```

**Alternative: Zustand**
- **Status:** Planned as lighter alternative
- **Pros:** Simpler API, less boilerplate, smaller bundle
- **Use Case:** Smaller components or specific feature state

---

### Data Fetching & Server State

#### React Query (TanStack Query)
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Server state management and caching

**Key Features:**
- **Automatic Caching:** Smart caching with stale-while-revalidate
- **Background Updates:** Automatic refetching on window focus
- **Optimistic Updates:** UI updates before server confirmation
- **Request Deduplication:** Prevents duplicate requests
- **Pagination Support:** Built-in pagination helpers

**Configuration:**
```javascript
// services/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        // Global error handling
        console.error('Mutation error:', error);
      }
    }
  }
});
```

**Usage Example:**
```typescript
// hooks/useHorses.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { horseService } from '../services/horseService';

export function useHorses() {
  const queryClient = useQueryClient();

  const { data: horses, isLoading } = useQuery({
    queryKey: ['horses'],
    queryFn: horseService.getAll
  });

  const trainHorse = useMutation({
    mutationFn: ({ horseId, discipline }) =>
      horseService.train(horseId, discipline),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['horses'] });
    }
  });

  return { horses, isLoading, trainHorse };
}
```

---

### UI Framework & Styling

#### Tailwind CSS with NativeWind
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Utility-first CSS framework for React Native

**Key Features:**
- **Utility Classes:** Pre-built CSS classes for rapid development
- **Responsive Design:** Responsive breakpoints
- **Dark Mode:** Built-in dark mode support
- **Customization:** Extensive theming capabilities

**Configuration:**
```javascript
// tailwind.config.js
module.exports = {
  content: [
    './App.{js,tsx}',
    './src/**/*.{js,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1'
        },
        secondary: {
          500: '#8b5cf6',
          600: '#7c3aed'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['Fira Code', 'monospace']
      }
    }
  },
  plugins: [
    require('tailwindcss-animate')
  ]
};
```

**Alternative: React Native Paper**
- **Status:** Planned as component library
- **Pros:** Pre-built Material Design components
- **Use Case:** Consistent, accessible UI components

---

### Forms & Validation

#### React Hook Form
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Performant form management

**Key Features:**
- **Performance:** Minimal re-renders
- **TypeScript:** Full type safety
- **Validation:** Integrated with Yup schema validation
- **DevTools:** Form state inspection

**Usage Example:**
```typescript
// components/HorseCreationForm.tsx
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

const schema = yup.object({
  name: yup.string().required('Horse name is required').min(2).max(50),
  age: yup.number().required('Age is required').min(0).max(30),
  breed: yup.string().required('Breed is required')
}).required();

export function HorseCreationForm({ onSubmit }) {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: yupResolver(schema)
  });

  return (
    <View>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Horse Name"
            error={errors.name}
          />
        )}
      />
      {/* More form fields */}
      <Button onPress={handleSubmit(onSubmit)}>Create Horse</Button>
    </View>
  );
}
```

---

### Data Visualization

#### Chart.js & Recharts
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Interactive charts and graphs

**Chart Types Needed:**
- **Line Charts:** Performance trends over time
- **Bar Charts:** Discipline score comparisons
- **Pie Charts:** Training distribution by discipline
- **Radar Charts:** Multi-stat comparisons
- **Area Charts:** XP progression visualization
- **Scatter Plots:** Horse stat distributions

**Library Comparison:**
| Feature | Chart.js | Recharts | D3.js |
|---------|----------|----------|-------|
| **Learning Curve** | Easy | Moderate | Hard |
| **Customization** | Good | Excellent | Unlimited |
| **Performance** | Excellent | Good | Excellent |
| **React Native** | Plugin needed | Native support | Requires wrapper |
| **Animations** | Built-in | Built-in | Manual |
| **Bundle Size** | Small | Medium | Large |

**Recommended:** Recharts for ease of use with React Native

---

### Navigation

#### React Navigation 6.x
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Navigation and routing for React Native

**Navigation Structure:**
```typescript
// navigation/AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack Navigators for each tab
function StableStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="StableOverview" component={StableOverviewScreen} />
      <Stack.Screen name="HorseList" component={HorseListScreen} />
      <Stack.Screen name="HorseDetail" component={HorseDetailScreen} />
    </Stack.Navigator>
  );
}

// Main Tab Navigator
export function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Stable" component={StableStack} />
        <Tab.Screen name="Training" component={TrainingStack} />
        <Tab.Screen name="Competition" component={CompetitionStack} />
        <Tab.Screen name="Breeding" component={BreedingStack} />
        <Tab.Screen name="Profile" component={ProfileStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

---

### Frontend Testing

#### Jest & React Native Testing Library
**Status:** ❌ Not Implemented (Planned)
**Purpose:** Component and integration testing

**Testing Strategy:**
```typescript
// __tests__/components/HorseCard.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { HorseCard } from '../HorseCard';

describe('HorseCard', () => {
  const mockHorse = {
    id: 1,
    name: 'Thunder',
    age: 5,
    breed: 'Thoroughbred',
    level: 10
  };

  test('renders horse information correctly', () => {
    const { getByText } = render(<HorseCard horse={mockHorse} />);

    expect(getByText('Thunder')).toBeTruthy();
    expect(getByText('Thoroughbred • 5 years')).toBeTruthy();
    expect(getByText('Level 10')).toBeTruthy();
  });

  test('calls onPress when card is tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <HorseCard horse={mockHorse} onPress={onPress} />
    );

    fireEvent.press(getByTestId('horse-card'));
    expect(onPress).toHaveBeenCalledWith(mockHorse);
  });
});
```

**Test Coverage Goals:**
- **Component Tests:** 80%+ coverage
- **Integration Tests:** All critical user flows
- **E2E Tests:** Main user journeys (Detox framework)

---

## Conclusion

Equoria's tech stack is built on modern, production-ready technologies that prioritize developer experience, performance, and scalability. The backend leverages Node.js, Express, and PostgreSQL for a robust, type-safe foundation, while the frontend uses React Native and Expo for efficient Modern web development.

Key strengths of this stack:
- **Type Safety:** Prisma ORM provides type safety across the entire backend
- **Testing Excellence:** 468+ tests with 90.1% success rate using balanced mocking philosophy
- **Security:** Enterprise-grade authentication, validation, and protection
- **Performance:** Optimized queries, caching strategies, and efficient algorithms
- **Developer Experience:** Hot reload, comprehensive documentation, clear patterns
- **Scalability:** Stateless architecture, horizontal scaling capability, modern cloud infrastructure

The technology choices reflect a balance between cutting-edge capabilities and production stability, ensuring Equoria can deliver a high-quality gaming experience while maintaining long-term code maintainability.

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-11-07 | Development Team | Initial comprehensive tech stack documentation |

---

**End of Technical Stack Documentation**
