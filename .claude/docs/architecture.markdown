# Equoria Project Architecture

## Overview
- **Frontend**: React Native with Expo for iOS and Android, JavaScript ES6+ with JSX, Tailwind CSS via NativeWind, modern component architecture
- **Backend**: Node.js with Express.js, layered architecture with controllers, models, services, and utilities
- **Database**: PostgreSQL with Prisma ORM, extensive JSONB usage for flexible game data storage
- **Authentication**: JWT-based authentication with refresh tokens, role-based access control
- **API**: RESTful endpoints under `/api/` with comprehensive validation and error handling

## Project Structure
```
Equoria/
├── frontend/               # React Native mobile app
│   ├── components/        # Reusable UI components
│   │   ├── TraitDisplay.js
│   │   ├── FoalDevelopmentTab.js
│   │   └── __tests__/
│   ├── screens/           # Main app screens (planned)
│   ├── navigation/        # Navigation structure (planned)
│   └── App.js
├── backend/               # Node.js/Express backend
│   ├── controllers/       # Business logic layer
│   │   ├── trainingController.js
│   │   ├── competitionController.js
│   │   └── authController.js
│   ├── models/           # Data access layer
│   │   ├── horseModel.js
│   │   ├── userModel.js
│   │   ├── trainingModel.js
│   │   └── resultModel.js
│   ├── routes/           # API endpoint definitions
│   │   ├── trainingRoutes.js
│   │   ├── competitionRoutes.js
│   │   └── authRoutes.js
│   ├── utils/            # Game mechanics and utilities
│   │   ├── statMap.js
│   │   ├── simulateCompetition.js
│   │   ├── trainingCooldown.js
│   │   └── isHorseEligible.js
│   ├── middleware/       # Express middleware
│   │   ├── auth.js
│   │   ├── validatePing.js
│   │   └── errorHandler.js
│   ├── seed/            # Database seeding
│   │   ├── horseSeed.js
│   │   └── seedShows.js
│   ├── config/          # Configuration management
│   │   └── config.js
│   ├── db/              # Database connection
│   │   └── index.js
│   ├── app.js           # Express application setup
│   └── server.js        # Server initialization
├── tests/               # Comprehensive test suite
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests
│   └── ui/            # UI component tests
├── prisma/             # Database schema and migrations
│   ├── schema.prisma
│   └── migrations/
├── .cursor/            # AI guidance and documentation
│   ├── rules/         # Modular development rules
│   └── docs/          # Technical documentation
└── docs/              # Additional documentation
```

## Technology Stack

### Frontend (React Native)
- **React Native + Expo**: Cross-platform mobile development with JavaScript ES6+
- **Tailwind CSS**: Utility-first styling via NativeWind
- **React Navigation**: Screen navigation and routing
- **React Query**: Server state management (planned)
- **Redux Toolkit**: Global state management (planned)

### Backend (Node.js/Express)
- **Express.js**: Web framework with middleware architecture
- **Prisma ORM**: Type-safe database operations with PostgreSQL
- **JWT**: Authentication with access/refresh token system
- **bcrypt**: Password hashing and security
- **express-validator**: Request validation and sanitization
- **helmet**: Security headers and protection
- **cors**: Cross-origin resource sharing
- **dotenv**: Environment variable management

### Database (PostgreSQL)
- **Core Tables**: Users, Horses, Foals, Shows, Competition Results, Training Logs
- **JSONB Fields**: Flexible storage for genetics, traits, discipline scores, settings
- **Relationships**: Complex foreign key relationships supporting game mechanics
- **Indexing**: Optimized for game-specific query patterns
- **Migrations**: Prisma-managed schema evolution

### Development Tools
- **Testing**: Jest for unit/integration tests, React Native Testing Library for UI
- **Code Quality**: ESLint + Prettier for consistent formatting
- **Version Control**: Git with GitHub Actions for CI/CD
- **Development**: Nodemon for auto-restart, comprehensive logging
- **Documentation**: Comprehensive technical documentation

## Architectural Patterns

### 1. Layered Backend Architecture
- **Routes Layer**: API endpoint definitions with validation
- **Controllers Layer**: Business logic and workflow orchestration
- **Models Layer**: Data access and database operations
- **Utils Layer**: Game mechanics, calculations, and utilities
- **Middleware Layer**: Cross-cutting concerns (auth, validation, error handling)

### 2. Component-Based Frontend
- **Reusable Components**: TraitDisplay, FoalDevelopmentTab with comprehensive testing
- **Screen Architecture**: Planned navigation with tab-based structure
- **State Management**: Local state with planned global state integration
- **Accessibility**: Full screen reader support and WCAG compliance

### 3. Database Design Patterns
- **JSONB Utilization**: Flexible schema for game data (genetics, traits, scores)
- **Relationship Modeling**: Complex associations supporting breeding, training, competition
- **Performance Optimization**: Strategic indexing and query optimization
- **Data Integrity**: Comprehensive validation at multiple layers

## Game Systems Architecture

### 1. Training System
- **Global Cooldown**: One discipline per week per horse
- **Age Restrictions**: 3+ years minimum for training participation
- **Progression**: +5 points per session in chosen discipline
- **History Tracking**: Complete training logs for analytics

### 2. Competition System
- **Eligibility Validation**: Age, level, and previous entry restrictions
- **Realistic Scoring**: Stat-based calculations with randomization
- **Result Tracking**: Comprehensive competition history and rankings
- **Prize Distribution**: Economic integration with game progression

### 3. Breeding System
- **Complex Genetics**: Multi-allele inheritance with dominant/recessive patterns
- **Trait Discovery**: Progressive revelation through foal development
- **Epigenetic Factors**: Environmental influences on trait expression
- **Lineage Tracking**: Parent relationships and breeding history

### 4. User Progression
- **Account System**: UUID-based user accounts with settings
- **Experience Tracking**: Level, XP, and money progression
- **Achievement System**: Milestone tracking and rewards (planned)
- **Social Features**: Leaderboards and competition rankings

## Security Architecture

### 1. Authentication & Authorization
- **JWT Implementation**: Access tokens with refresh token rotation
- **Role-Based Access**: User, Moderator, Admin roles with permissions
- **Password Security**: bcrypt hashing with configurable salt rounds
- **Session Management**: Secure token storage and validation

### 2. Data Protection
- **Input Validation**: express-validator at API boundaries
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **Environment Security**: Sensitive data in environment variables
- **HTTPS Enforcement**: Secure communication in production

### 3. Rate Limiting & Protection
- **API Rate Limiting**: Request throttling per endpoint
- **Security Headers**: helmet middleware for protection
- **CORS Configuration**: Controlled cross-origin access
- **Error Handling**: Secure error responses without data leakage

## Performance Considerations

### 1. Database Performance
- **Connection Pooling**: Optimized database connections
- **Query Optimization**: Strategic indexing and efficient queries
- **JSONB Indexing**: GIN indexes for flexible data queries
- **Relationship Loading**: Selective loading of related data

### 2. API Performance
- **Response Optimization**: Minimal data transfer with selective loading
- **Caching Strategy**: Planned implementation for frequently accessed data
- **Pagination**: Efficient handling of large data sets
- **Background Processing**: Planned async processing for heavy operations

### 3. Mobile Performance
- **Component Optimization**: React.memo and efficient re-rendering
- **Asset Optimization**: Image compression and lazy loading
- **Bundle Size**: Code splitting and tree shaking
- **Offline Capability**: Planned offline-first features

## Development Quality

### 1. Testing Strategy
- **468+ Tests**: Comprehensive test coverage across all systems
- **TDD Approach**: Test-driven development for all features
- **Integration Testing**: End-to-end workflow validation
- **Performance Testing**: Load testing for critical operations

### 2. Code Quality
- **Consistent Patterns**: Standardized approaches across codebase
- **Documentation**: Comprehensive function and API documentation
- **Error Handling**: Graceful error management at all layers
- **Maintainability**: Modular design for easy feature addition

### 3. Deployment Ready
- **Environment Management**: Development, testing, production isolation
- **CI/CD Pipeline**: Automated testing and deployment
- **Monitoring**: Comprehensive logging and error tracking
- **Scalability**: Architecture designed for horizontal scaling

## References
- **API Documentation**: `@docs/api_specs.markdown`
- **Database Schema**: `@docs/database-infrastructure.md`
- **Frontend Architecture**: `@docs/frontend-architecture.md`
- **Backend Details**: `@docs/backend-overview.md`
- **Testing Strategy**: `@docs/testing-architecture.md`