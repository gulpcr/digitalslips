# Precision Receipt

**Production-Grade Digital Transaction Receipt System for Meezan Bank Pakistan**

A comprehensive banking solution for generating, managing, and verifying digital transaction receipts with WhatsApp integration, QR code verification, and blockchain-backed security.

---

## 🏗️ Technology Stack

### Backend
- **Python 3.11+** with **FastAPI**
- **PostgreSQL 15+** with **SQLAlchemy ORM**
- **Pydantic** for validation
- **JWT** authentication
- **Redis** for caching/sessions
- **Uvicorn** ASGI server

### Frontend
- **React 18** with **TypeScript**
- **Tailwind CSS** with custom design system
- **Vite** build tool
- **React Router** for routing
- **Zustand** for state management
- **TanStack Query** for data fetching

### Infrastructure
- **Docker** & **Docker Compose**
- **PostgreSQL** with connection pooling
- **Redis** for caching
- Production-ready logging and monitoring

---

## 🎨 Design System

The frontend follows a **Navy + Cyan** enterprise design palette:

- **Primary (Brand Navy)**: `#0B1F3B`
- **Accent (Electric Cyan)**: `#00A7FF`
- **Background**: `#F6F8FB`
- **Surface**: `#FFFFFF`
- **Text Primary**: `#0F172A`
- **Text Secondary**: `#475569`

### Design Principles
✓ Modern enterprise AI product feel
✓ Clean layouts with generous whitespace
✓ Strong typography hierarchy (Inter font)
✓ Consistent 8px border radius for buttons
✓ Cyan focus rings for accessibility
✓ Subtle card shadows

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** (for frontend)
- **Python 3.11+** (for backend)
- **Docker & Docker Compose** (recommended)
- **PostgreSQL 15+** (if not using Docker)
- **Redis** (optional, for caching)

---

## 🚀 Quick Start with Docker

### 1. Clone the Repository

```bash
git clone <repository-url>
cd precision-receipt
```

### 2. Configure Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your configurations

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env if needed
```

### 3. Start All Services

```bash
docker-compose up -d
```

This will start:
- **PostgreSQL** on port `5432`
- **Redis** on port `6379`
- **Backend API** on port `8000`
- **Frontend** on port `5173`

### 4. Seed the Database

```bash
# Wait for services to be healthy, then seed the database
docker-compose exec backend python app/database/seed.py
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

---

## 💻 Manual Installation

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env file

# Create database tables
python -c "from app.core.database import init_db; init_db()"

# Seed database
python app/database/seed.py

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Run development server
npm run dev
```

---

## 📁 Project Structure

```
precision-receipt/
├── backend/
│   ├── app/
│   │   ├── api/              # API endpoints
│   │   ├── core/             # Core configurations
│   │   │   ├── config.py     # Settings
│   │   │   └── database.py   # Database connection
│   │   ├── database/
│   │   │   └── seed.py       # Seed data
│   │   ├── models/           # SQLAlchemy models
│   │   │   └── __init__.py   # All database models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   └── main.py           # FastAPI application
│   ├── logs/                 # Application logs
│   ├── uploads/              # File uploads
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── ui/           # Reusable UI components
│   │   │       ├── Button.tsx
│   │   │       ├── Card.tsx
│   │   │       ├── Input.tsx
│   │   │       └── Table.tsx
│   │   ├── theme/
│   │   │   └── index.ts      # Design system tokens
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API services
│   │   ├── store/            # Zustand stores
│   │   └── App.tsx
│   ├── tailwind.config.js    # Tailwind configuration
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
└── docker-compose.yml
```

---

## 🗄️ Database Schema

The system includes 10 main tables:

1. **Users** - System user accounts (Admin, Manager, Teller, Auditor)
2. **Branches** - Bank branch locations
3. **Customers** - Customer information with KYC
4. **Accounts** - Customer bank accounts
5. **Transactions** - Financial transactions
6. **Receipts** - Digital receipt records
7. **Notifications** - Multi-channel notifications
8. **AuditLog** - Complete audit trail
9. **SystemSettings** - Configuration parameters
10. **Session** - User authentication sessions

---

## 🔐 Default Credentials

After seeding the database:

```
Admin User:
  Username: admin
  Password: Admin@123456

Branch Managers:
  Password: Manager@123

Tellers:
  Password: Teller@123
```

**⚠️ IMPORTANT**: Change these passwords in production!

---

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm run test
```

---

## 📦 Building for Production

### Backend
```bash
cd backend
docker build -t precision-receipt-backend .
```

### Frontend
```bash
cd frontend
npm run build
docker build -t precision-receipt-frontend .
```

---

## 🌐 Environment Variables

### Critical Backend Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_SECRET` | Secret key for JWT tokens | ✅ |
| `ENCRYPTION_KEY` | 32-byte encryption key | ✅ |
| `WHATSAPP_API_KEY` | WhatsApp Business API key | ❌ |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | ❌ |
| `T24_API_URL` | T24 core banking API | ✅ |

See `backend/.env.example` for complete list.

### Frontend Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8000/api` |

---

## 🔧 Development Tools

### Backend Linting
```bash
cd backend
black app/  # Format code
flake8 app/  # Lint code
mypy app/   # Type checking
```

### Frontend Linting
```bash
cd frontend
npm run lint    # ESLint
npm run format  # Prettier
```

---

## 📝 API Documentation

Once the backend is running, visit:

- **Swagger UI**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc

---

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

---

## 📄 License

Proprietary - Meezan Bank Pakistan / eDimensionz

---

## 🆘 Support

For issues and questions:
- Technical Support: tech@meezanbank.com
- Documentation: [Internal Wiki]

---

## 🎯 Roadmap

- [ ] Biometric authentication
- [ ] Mobile app (React Native)
- [ ] Advanced fraud detection with ML
- [ ] Multi-language support (Urdu, English)
- [ ] Blockchain receipt verification
- [ ] Real-time analytics dashboard

---

**Built with ❤️ by eDimensionz for Meezan Bank Pakistan**
