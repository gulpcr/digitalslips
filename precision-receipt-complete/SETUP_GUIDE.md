# Precision Receipt - Setup & Deployment Guide

## 🎯 Complete Setup Checklist

### Prerequisites Installation

#### 1. Install Node.js 20+
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS (using Homebrew)
brew install node@20

# Verify
node --version  # Should be 20.x.x
npm --version   # Should be 10.x.x
```

#### 2. Install Python 3.11+
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3-pip

# macOS (using Homebrew)
brew install python@3.11

# Verify
python3.11 --version
```

#### 3. Install Docker & Docker Compose
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Verify
docker --version
docker compose version
```

## 🚀 Step-by-Step Setup

### Option 1: Docker Setup (Recommended for Production)

#### Step 1: Clone & Configure
```bash
git clone <repository-url>
cd precision-receipt

# Backend environment
cp backend/.env.example backend/.env
nano backend/.env  # Edit with your settings

# Frontend environment
cp frontend/.env.example frontend/.env
nano frontend/.env  # Edit if needed
```

#### Step 2: Start Services
```bash
# Start all services in detached mode
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

#### Step 3: Initialize Database
```bash
# Wait for PostgreSQL to be ready (check logs)
docker-compose logs postgres

# Seed the database
docker-compose exec backend python app/database/seed.py
```

#### Step 4: Access Applications
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Option 2: Local Development Setup

#### Backend Setup
```bash
cd backend

# Create virtual environment
python3.11 -m venv venv

# Activate virtual environment
source venv/bin/activate  # Linux/macOS
# OR
venv\Scripts\activate  # Windows

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Setup PostgreSQL database
createdb precision_receipt
# OR using psql:
# psql -U postgres -c "CREATE DATABASE precision_receipt;"

# Configure environment
cp .env.example .env
nano .env  # Update DATABASE_URL and other settings

# Initialize database tables
python -c "from app.core.database import init_db; init_db()"

# Seed database
python app/database/seed.py

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Update API_URL if needed

# Run development server
npm run dev

# Open browser
# Navigate to http://localhost:5173
```

## 🔧 Common Development Tasks

### Database Operations

#### Create Migration (Alembic)
```bash
cd backend
source venv/bin/activate

# Auto-generate migration
alembic revision --autogenerate -m "Add new table"

# Review migration file
ls alembic/versions/

# Apply migration
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

#### Reset Database
```bash
# Using Docker
docker-compose down
docker volume rm precision-receipt_postgres_data
docker-compose up -d
docker-compose exec backend python app/database/seed.py

# Local
dropdb precision_receipt
createdb precision_receipt
cd backend
python app/database/seed.py
```

### Code Quality

#### Backend Linting & Formatting
```bash
cd backend
source venv/bin/activate

# Format code
black app/

# Check linting
flake8 app/

# Type checking
mypy app/

# Run tests
pytest

# With coverage
pytest --cov=app --cov-report=html
```

#### Frontend Linting & Formatting
```bash
cd frontend

# Lint code
npm run lint

# Fix linting issues
npm run lint --fix

# Format code
npm run format

# Type check
npm run build  # TypeScript compilation

# Run tests (when implemented)
npm test
```

### Environment Management

#### Backend Environment Variables
```bash
# Development
export NODE_ENV=development
export DEBUG=true

# Production
export NODE_ENV=production
export DEBUG=false
```

#### Frontend Environment Variables
```bash
# .env.development
VITE_API_URL=http://localhost:8000/api

# .env.production
VITE_API_URL=https://api.meezanbank.com/api
```

## 🏗️ Production Deployment

### Preparing for Production

#### 1. Backend Production Build
```bash
cd backend

# Update .env for production
NODE_ENV=production
DEBUG=false
# Update all secrets and API keys

# Build Docker image
docker build -t precision-receipt-backend:1.0.0 .

# Test the build
docker run -p 8000:8000 precision-receipt-backend:1.0.0
```

#### 2. Frontend Production Build
```bash
cd frontend

# Build for production
npm run build

# Test production build
npm run preview

# Build Docker image
docker build -t precision-receipt-frontend:1.0.0 .
```

### Docker Deployment

#### Using Docker Compose (Production)
```bash
# Create production docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    restart: always

  backend:
    image: precision-receipt-backend:1.0.0
    environment:
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    restart: always

  frontend:
    image: precision-receipt-frontend:1.0.0
    environment:
      VITE_API_URL: ${API_URL}
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: always

volumes:
  postgres_data:
```

### Kubernetes Deployment (Optional)

#### Sample Deployment Configuration
```yaml
# backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: precision-receipt-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: precision-receipt-backend
  template:
    metadata:
      labels:
        app: precision-receipt-backend
    spec:
      containers:
      - name: backend
        image: precision-receipt-backend:1.0.0
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: precision-receipt-secrets
              key: database-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: precision-receipt-secrets
              key: jwt-secret
```

## 🔍 Monitoring & Debugging

### View Logs

#### Docker
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f postgres

# Last 100 lines
docker-compose logs --tail=100 backend
```

#### Backend Logs
```bash
cd backend
tail -f logs/precision-receipt.log

# With grep
tail -f logs/precision-receipt.log | grep ERROR
```

### Database Access

#### Using Docker
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U precision -d precision_receipt

# Run SQL query
docker-compose exec postgres psql -U precision -d precision_receipt -c "SELECT * FROM users;"

# Connect to Redis
docker-compose exec redis redis-cli
```

#### Direct Connection
```bash
# PostgreSQL
psql -h localhost -U precision -d precision_receipt

# Common queries
# List all tables
\dt

# Describe table
\d users

# Count records
SELECT COUNT(*) FROM transactions;
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run specific test file
pytest tests/test_auth.py

# With coverage
pytest --cov=app --cov-report=html

# View coverage report
open htmlcov/index.html
```

### Frontend Tests
```bash
cd frontend

# Run tests
npm test

# With coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

### API Testing (Manual)
```bash
# Health check
curl http://localhost:8000/health

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}'

# Get transactions (with token)
curl http://localhost:8000/api/v1/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 🔒 Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET (min 32 characters)
- [ ] Use HTTPS in production
- [ ] Enable rate limiting
- [ ] Configure CORS properly
- [ ] Set up firewall rules
- [ ] Enable database connection encryption
- [ ] Regular security updates
- [ ] Implement backup strategy
- [ ] Set up monitoring and alerts

## 📊 Performance Optimization

### Backend
- [ ] Enable database connection pooling
- [ ] Use Redis for caching
- [ ] Implement pagination
- [ ] Add database indexes
- [ ] Enable GZIP compression
- [ ] Use async endpoints where possible

### Frontend
- [ ] Code splitting
- [ ] Lazy loading components
- [ ] Image optimization
- [ ] Cache API responses
- [ ] Minimize bundle size
- [ ] Use production build

## 🆘 Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready
```

### Port Already in Use
```bash
# Find process using port 8000
lsof -i :8000

# Kill process
kill -9 <PID>
```

### Docker Issues
```bash
# Clean up Docker
docker-compose down -v
docker system prune -a

# Rebuild images
docker-compose build --no-cache
```

## 📚 Additional Resources

- FastAPI Documentation: https://fastapi.tiangolo.com/
- React Documentation: https://react.dev/
- Tailwind CSS: https://tailwindcss.com/docs
- SQLAlchemy: https://docs.sqlalchemy.org/
- PostgreSQL: https://www.postgresql.org/docs/

---

**Need Help?** Contact: tech@meezanbank.com
