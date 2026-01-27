# 🐎 Equoria - Horse Breeding & Competition Simulation

A comprehensive horse breeding and competition simulation game backend built with Node.js, Express, and PostgreSQL.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/machsheltie/Equoria.git
cd Equoria

# Install dependencies
npm install
cd backend && npm install

# Set up environment variables
cp env.example .env
# Edit .env with your database credentials

# Run database migrations
cd packages/database
npx prisma migrate dev

# Start the development server
cd ../../backend
npm run dev
```

## 📡 API Endpoints

The Equoria API provides comprehensive endpoints for managing horses, users, competitions, and game mechanics.

### Base URL

- **Development**: `http://localhost:3000/api`
- **Production**: `https://api.equoria.com/api`

### Core Endpoints

#### User Management

- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/:id/progress` - Get user progress and XP
- `POST /api/users/:id/add-xp` - Add XP to user

#### Horse Management

- `GET /api/horses` - List all horses
- `GET /api/horses/:id` - Get horse by ID
- `POST /api/horses` - Create new horse
- `PUT /api/horses/:id` - Update horse
- `DELETE /api/horses/:id` - Delete horse

#### Competition System

- `GET /api/competition` - List competitions
- `POST /api/competition/enter` - Enter horse in competition
- `GET /api/competition/:id/results` - Get competition results

#### Leaderboards

- `GET /api/leaderboards/players/level` - Top players by level
- `GET /api/leaderboards/players/xp` - Top players by XP
- `GET /api/leaderboards/horses/earnings` - Top horses by earnings
- `GET /api/leaderboards/horses/performance` - Top horses by performance
- `GET /api/leaderboards/recent-winners` - Recent competition winners
- `GET /api/leaderboards/stats` - Comprehensive statistics

#### Milestone System

- `POST /api/milestones/evaluate-milestone` - Evaluate milestone for a horse
- `GET /api/milestones/milestone-status/:horseId` - Get milestone status
- `GET /api/milestones/milestone-definitions` - Get milestone definitions

#### Training & Development

- `POST /api/training/session` - Start training session
- `GET /api/training/history/:horseId` - Get training history
- `GET /api/foals` - List foals
- `POST /api/foals` - Create new foal

#### Traits & Genetics

- `GET /api/traits` - List available traits
- `POST /api/trait-discovery/analyze` - Analyze horse traits
- `GET /api/breeds` - List horse breeds

#### Groom Management

- `GET /api/grooms` - List grooms
- `POST /api/grooms` - Create new groom
- `PUT /api/grooms/:id` - Update groom

### Authentication

All API endpoints require JWT authentication:

```bash
Authorization: Bearer <your-jwt-token>
```

### Response Format

All API responses follow a consistent format:

```json
{
  "success": true|false,
  "message": "Descriptive message",
  "data": { ... } | null,
  "error": null | "Error description"
}
```

## 🏗️ Architecture

### Backend Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with refresh tokens
- **Testing**: Jest with comprehensive test coverage
- **Code Quality**: ESLint + Prettier

### Database Schema

- **Users**: Player accounts and progression
- **Horses**: Horse entities with genetics and stats
- **Competitions**: Competition events and results
- **Training**: Training sessions and progression
- **Breeding**: Foal development and genetics

### Key Features

- 🧬 **Complex Genetics System**: Advanced breeding mechanics
- 🏆 **Competition Engine**: Realistic competition simulation
- 📊 **Statistics Tracking**: Comprehensive stat system
- 🎯 **Milestone System**: Achievement and progression tracking
- 🔒 **Security**: Enterprise-grade security with rate limiting

## 🧪 Testing

```bash
# Run all tests
npm run test-backend

# Run tests with coverage
npm run test-backend:coverage

# Run tests in watch mode
npm run test-backend:watch
```

## 🔧 Development

### Scripts

```bash
# Start development server
npm run dev-backend

# Start production server
npm run start-backend

# Lint code
npm run lint-backend

# Fix linting issues
npm run lint:fix-backend

# Format code
npm run format-backend
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/equoria

# Authentication
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Server
PORT=3000
NODE_ENV=development
```

## 📚 Documentation

- **API Specifications**: `backend/.augment/docs/api_specs.markdown`
- **Database Schema**: `backend/.augment/docs/database_schema.markdown`
- **Architecture**: `backend/.augment/docs/architecture.markdown`
- **Swagger/OpenAPI**: Available at `/api-docs` when server is running

## 🚀 Deployment

### Docker

```bash
# Build image
docker build -t equoria-backend .

# Run container
docker run -d \
  --name equoria \
  -p 3000:3000 \
  -e DATABASE_URL=$DATABASE_URL \
  -e JWT_SECRET=$JWT_SECRET \
  equoria-backend
```

### Health Check

The application provides a health check endpoint:

```bash
GET /health
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Write tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 📄 License

This project is licensed under the ISC License.

## 🔗 Links

- **Repository**: https://github.com/machsheltie/Equoria
- **Issues**: https://github.com/machsheltie/Equoria/issues
- **API Documentation**: Available at `/api-docs` endpoint

---

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/machsheltie/Equoria?utm_source=oss&utm_medium=github&utm_campaign=machsheltie%2FEquoria&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

**Built with ❤️ for horse enthusiasts and simulation game lovers**
