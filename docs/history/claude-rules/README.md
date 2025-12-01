---
type: "always_apply"
---

# 🐎 Equoria - Horse Breeding & Competition Simulation
A comprehensive horse breeding and competition simulation game backend built with Node.js, Express, and PostgreSQL.

[See General Rules](./GENERAL_RULES.md)
[ESModules Requirements](./ES_MODULES_REQUIREMENTS.md)
[DEV_NOTES](./DEV_NOTES.md)
[PROJECT_MILESTONES]./PROJECT)_MILESTONES.md)


## 🌟 Features

- **🏇 Competition System**: Advanced horse competition simulation with realistic scoring
- **🧬 Breeding Mechanics**: Complex genetic system for horse breeding
- **👥 Groom Management**: Professional groom system with age-based foal care
- **📊 Statistics Tracking**: Comprehensive stat system with 10+ attributes
- **🏆 Prize Distribution**: Dynamic prize allocation and stat gains
- **🔒 Security**: Enterprise-grade security with rate limiting, CORS, and helmet
- **🔐 Authentication**: Complete JWT-based authentication system
- **🧪 Test Excellence**: 113 test files + 22 Groom API tests with mathematically proven balanced mocking (90.1% vs 1% success rate)
- **📝 Logging**: Structured logging with Winston
- **🗄️ Database**: PostgreSQL with Prisma ORM and migrations
- **📚 API Documentation**: Interactive Swagger/OpenAPI documentation
- **❤️ Health Monitoring**: Comprehensive health checks with database status
- **🐳 Docker Ready**: Production-ready Docker configuration

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/equoria.git
   cd equoria
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install database dependencies
   cd ../packages/database
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cd ../../backend
   cp .env.example .env

   # Edit .env with your database credentials
   DATABASE_URL="postgresql://username:password@localhost:5432/equoria"
   PORT=3000
   NODE_ENV=development
   ```

4. **Database Setup**
   ```bash
   # Run migrations
   cd ../packages/database
   npx prisma migrate deploy

   # Generate Prisma client
   npx prisma generate
   ```

5. **Start the server**
   ```bash
   cd ../../backend
   npm run dev
   ```

The server will start on `http://localhost:3000`

## 📁 Project Structure

```
equoria/
├── backend/                 # Main application
│   ├── controllers/         # Route controllers
│   ├── middleware/          # Custom middleware
│   ├── models/             # Data models
│   ├── routes/             # API routes
│   ├── utils/              # Utility functions
│   ├── logic/              # Business logic
│   ├── errors/             # Custom error classes
│   └── tests/              # Test files
├── packages/
│   └── database/           # Database package
│       ├── prisma/         # Prisma schema & migrations
│       └── prismaClient.js # Prisma client setup
└── docs/                   # Documentation
```

## 🔧 API Endpoints

### Health & Monitoring
- `GET /ping` - Simple ping/pong health check
- `GET /health` - Comprehensive health check with database status

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/profile` - Get user profile (protected)
- `PUT /api/auth/profile` - Update user profile (protected)

### User Progress & Dashboard
- `GET /api/users/:id/progress` - Get comprehensive user progress data (protected)
- `GET /api/dashboard/:userId` - Get user dashboard with horses, shows, and activity (protected)

### Breeds
- `GET /api/breeds` - Get all horse breeds
- `GET /api/breeds/:id` - Get breed by ID
- `POST /api/breeds` - Create new breed

### Competitions
- `POST /api/competition/enter` - Enter horses in competition

### Traits
- `POST /api/traits/discover/:horseId` - Trigger trait discovery for a horse
- `GET /api/traits/horse/:horseId` - Get all traits for a horse
- `GET /api/traits/definitions` - Get all trait definitions
- `GET /api/traits/discovery-status/:horseId` - Get discovery status for a horse
- `POST /api/traits/batch-discover` - Trigger discovery for multiple horses
- `GET /api/traits/competition-impact/:horseId` - Analyze trait impact for specific discipline
- `GET /api/traits/competition-comparison/:horseId` - Compare trait impact across all disciplines
- `GET /api/traits/competition-effects` - Get all trait competition effects and definitions

### Grooms (100% API Tested)
- `POST /api/grooms/hire` - Hire a new groom with skill/personality selection
- `POST /api/grooms/assign` - Assign a groom to a foal with priority and notes
- `POST /api/grooms/interact` - Record groom interaction with comprehensive validation
- `GET /api/grooms/definitions` - Get groom system definitions and configurations
- `GET /api/grooms/user/:userid` - Get all grooms for a specific user
- `GET /api/grooms/assignments/:foalId` - Get all assignments for a foal
- `DELETE /api/grooms/test/cleanup` - Test data cleanup for development/testing

### Documentation
- `GET /api-docs` - Interactive API documentation (Swagger UI)
- `GET /api-docs.json` - OpenAPI specification JSON

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Categories & Philosophy
- **Balanced Mocking Tests (84 files)**: 90.1% success rate - Strategic external dependency mocking only
- **Pure Algorithmic Tests**: 100% success rates for utility functions with no mocking
- **Integration Tests**: Real database operations revealing actual implementation gaps
- **API Tests (22 Groom endpoints)**: 100% success rate - Complete business logic validation
- **Over-mocking Tests (16 files)**: ~1% success rate - Artificial test environments missing real issues
- **Strategic Mocking**: Database/logger only mocking maintaining high success while enabling unit testing

## 🏗️ Development

### Available Scripts

```bash
npm run dev          # Start development server with nodemon
npm start           # Start production server
npm test            # Run test suite
npm run seed        # Seed database with sample data
npm run seed:shows  # Seed competition shows
```
The project follows strict coding standards:

## Developer Standards
See [GENERAL_RULES.md](./GENERAL_RULES.md) for full coding conventions, ESLint/Prettier enforcement, naming standards, file layout, and module usage.

Key highlights:
- ✅ Pure ESModules (`.mjs`)
- ✅ camelCase everywhere (no snake_case)
- ✅ ESLint + Prettier enforced via GitHub Actions
- ✅ Strict folder structure: `/routes`, `/models`, `/controllers`, `/utils`

# Folder Structure Standards
> Enforced for ESModule clarity and consistent augment usage.
/src
/routes -> route handler definitions (e.g. horseRoutes.mjs)
/controllers -> logic separated from routes
/models -> database models (e.g. using Prisma or Mongoose)
/utils -> reusable helper logic (e.g. cooldown, date, math)
/middleware -> authentication, error handling
/tests -> full TDD-verified integration/unit tests

- All files must use `.mjs`
- Never use CommonJS (`require`, `module.exports`)
- ESModules: always use `import`, `export`
- Absolute imports allowed via `NODE_PATH=src`

---

## Code Quality Standards
- **ESLint + Prettier**: Consistent code formatting and style enforcement
- **Comprehensive Documentation**: Function specifications and API documentation
- **Error Handling**: Graceful error management at all application layers
- **Security Best Practices**: Input validation, authentication, authorization
- **Performance Optimization**: Database indexing, query optimization, efficient algorithms
- **Husky**: Pre-commit hooks
- **Jest**: Testing framework
- **ES Modules**: Modern JavaScript modules

## 🔒 Security Features

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API request throttling
- **Input Validation**: Request validation with express-validator
- **Error Handling**: Structured error responses
- **Logging**: Security event logging

## 🗄️ Database Schema

### Core Models

- **Horse**: Complete horse data with stats and genetics
- **Breed**: Horse breed definitions
- **User**: User accounts and progression
- **Show**: Competition events
- **CompetitionResult**: Competition history and results

### Production Readiness
- **Environment Management**: Development, testing, production isolation
- **CI/CD Pipeline**: Automated testing and deployment workflows
- **Security Implementation**: JWT authentication, password hashing, input validation
- **Monitoring**: Comprehensive logging and error tracking systems
- **Scalability**: Architecture designed for horizontal scaling

### ✅ Fully Implemented Systems
- **Backend Architecture**: Complete layered architecture with controllers, models, routes
- **Training System**: Global cooldown, age restrictions, discipline progression
- **Competition System**: Show management, eligibility validation, result tracking
- **User Management**: UUID accounts, progression tracking, horse relationships
- **Database Schema**: Comprehensive tables with JSONB flexibility
- **Testing Infrastructure**: 468+ tests with comprehensive coverage
- **Authentication**: JWT-based security with role-based access

### 🚧 In Development
- **Frontend Screens**: Main application screens (planned architecture complete)
- **Navigation System**: React Navigation integration
- **State Management**: Redux Toolkit or Zustand integration
- **Real-time Features**: Live updates and notifications

### 📋 Planned Features
- **Social System**: User interactions, leaderboards, achievements
- **Advanced Breeding**: Enhanced genetics simulation and visualization
- **Seasonal Events**: Temporary content and challenges
- **Monetization Integration**: IAP implementation and premium features

## Unique Selling Points

### 1. Technical Innovation
- **JSONB Genetics**: Advanced genetics storage enabling complex inheritance
- **Global Training Cooldown**: Prevents stat stacking while maintaining strategy
- **Trait Discovery**: Progressive trait revelation creating engagement loops
- **Realistic Competition**: Stat-based scoring with balanced randomization

### 2. Game Design Excellence
- **Strategic Depth**: Long-term planning required for breeding and training
- **Educational Value**: Realistic horse breeding and training simulation
- **Progressive Complexity**: Accommodates various skill levels and play styles
- **Community Features**: Competitive elements with social interaction

### 3. Development Excellence
- **Enterprise Quality**: 468+ tests, comprehensive documentation, security implementation
- **Scalable Architecture**: Designed for growth and feature expansion
- **Mobile-First Design**: Optimized for touch interactions and accessibility
- **Production Ready**: Complete deployment infrastructure and monitoring

## Performance Metrics

### Database Performance
- **Optimized Indexing**: Strategic indexes for game-specific queries
- **JSONB Efficiency**: GIN indexes for flexible trait and genetics queries
- **Connection Pooling**: Optimized database connection management
- **Query Optimization**: Efficient relationship loading and data retrieval

### API Performance
- **Response Times**: <200ms for critical game operations
- **Validation**: Comprehensive input validation with express-validator
- **Error Handling**: Graceful error responses with proper HTTP status codes
- **Rate Limiting**: Request throttling for security and performance

### Mobile Performance
- **Component Optimization**: Efficient React Native rendering patterns
- **Accessibility**: WCAG compliance with comprehensive screen reader support
- **Asset Management**: Optimized images and bundle size
- **User Experience**: Smooth animations and responsive interactions

## Security Implementation

### Authentication & Authorization
- **JWT Tokens**: Secure access and refresh token system
- **Role-Based Access**: User, Moderator, Admin permission levels
- **Password Security**: bcrypt hashing with configurable salt rounds
- **Session Management**: Secure token validation and refresh

### Data Protection
- **Input Validation**: Multi-layer validation preventing malicious input
- **SQL Injection Prevention**: Parameterized queries via Prisma ORM
- **Environment Security**: Sensitive configuration in environment variables
- **HTTPS Enforcement**: Secure communication in production

## Deployment Architecture

### Environment Configuration
- **Development**: Local PostgreSQL with comprehensive seeding
- **Testing**: Isolated test database with automated cleanup
- **Production**: Optimized configuration with monitoring and backup

### CI/CD Integration
- **Automated Testing**: All 468+ tests run on every commit
- **Code Quality**: ESLint and Prettier validation
- **Deployment Pipeline**: Automated deployment with rollback capability
- **Monitoring**: Comprehensive logging and error tracking

## References and Documentation
- **Project Overview**: `@docs/project-summary.md`
- **Technical Architecture**: `@docs/architecture.markdown`
- **API Documentation**: `@docs/api_specs.markdown`
- **Database Schema**: `@docs/database_schema.markdown`
- **Frontend Details**: `@docs/frontend-architecture.md`
- **Backend Implementation**: `@docs/backend-overview.md`
- **Testing Strategy**: `@docs/testing-architecture.md`
- **Development Rules**: `.cursor/rules/` directory for AI guidance

### Key Features

- **Prisma ORM**: Type-safe database access
- **Migrations**: Version-controlled schema changes
- **Relationships**: Complex data relationships
- **Indexing**: Optimized query performance

## 🎮 Game Mechanics

### Competition System

The competition system uses a sophisticated scoring algorithm:

```
🏇 FinalScore =
  BaseStatScore (weighted: 50/30/20)
+ TraitBonus (+5 if discipline matches horse trait)
+ TrainingScore (0–100, optional)
+ SaddleBonus (flat number)
+ BridleBonus (flat number)
+ RiderBonus (% of subtotal)
- RiderPenalty (% of subtotal)
+ HealthModifier (% adjustment based on rating)
+ RandomLuck (±9% for realism)
```

### Stat System

Horses have 10 core statistics:
- Speed, Stamina, Agility, Balance, Precision
- Intelligence, Boldness, Flexibility, Obedience, Focus

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TDD (Test-Driven Development) with balanced mocking principles
- Use strategic mocking (external dependencies only) - avoid over-mocking business logic
- Write comprehensive tests focusing on real functionality validation
- Pure algorithmic testing for utility functions (no mocking)
- Integration tests with real database operations to catch implementation gaps
- Use meaningful commit messages
- Update documentation for API changes
- Ensure all tests pass before submitting PR
- Maintain 90%+ test success rates through balanced mocking approach
- - Cross-reference exports/imports
- Alert on alias mismatches
- Recommend consistent renaming and refactoring
- Prevent test failures due to mismatched identifiers


## 📊 Performance

- **Response Time**: < 100ms for most endpoints
- **Throughput**: 1000+ requests/minute
- **Database**: Optimized queries with indexing
- **Memory**: Efficient memory usage with connection pooling

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   # Check PostgreSQL is running
   sudo service postgresql status

   # Verify DATABASE_URL in .env
   ```

2. **Prisma Client Error**
   ```bash
   # Regenerate Prisma client
   cd packages/database
   npx prisma generate
   ```

3. **Port Already in Use**
   ```bash
   # Change PORT in .env or kill process
   lsof -ti:3000 | xargs kill -9
   ```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern Node.js best practices
- Inspired by real horse breeding and competition mechanics
- Community-driven development approach

---

**Made with ❤️ by the Equoria Team**