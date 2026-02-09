# Organize Files into Proper Structure
# This script will move all files into the correct backend/frontend folders

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Organizing Precision Receipt Files" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create directory structure
Write-Host "Creating directory structure..." -ForegroundColor Yellow

# Backend structure
New-Item -ItemType Directory -Force -Path "backend" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\app" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\app\core" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\app\models" | Out-Null
New-Item -ItemType Directory -Force -Path "backend\app\database" | Out-Null

# Frontend structure
New-Item -ItemType Directory -Force -Path "frontend" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\components" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\components\ui" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\pages" | Out-Null
New-Item -ItemType Directory -Force -Path "frontend\src\theme" | Out-Null

Write-Host "[OK] Directories created" -ForegroundColor Green
Write-Host ""

# Move backend files
Write-Host "Moving backend files..." -ForegroundColor Yellow

# Core files
if (Test-Path "config.py") { Move-Item "config.py" "backend\app\core\" -Force }
if (Test-Path "database.py") { Move-Item "database.py" "backend\app\core\" -Force }

# Database files
if (Test-Path "seed.py") { Move-Item "seed.py" "backend\app\database\" -Force }

# Models
if (Test-Path "__init__.py") { Move-Item "__init__.py" "backend\app\models\" -Force }

# Main app file
if (Test-Path "main.py") { Move-Item "main.py" "backend\app\" -Force }

# Backend root files
if (Test-Path "requirements.txt") { Move-Item "requirements.txt" "backend\" -Force }

# Handle .env.example - there might be two, keep one for backend
$envFiles = Get-ChildItem -Filter ".env.example"
if ($envFiles.Count -gt 0) {
    Copy-Item $envFiles[0].FullName "backend\.env.example" -Force
    if ($envFiles.Count -gt 1) {
        Copy-Item $envFiles[1].FullName "frontend\.env.example" -Force
    }
}

# Handle Dockerfile - there might be two
$dockerFiles = Get-ChildItem -Filter "Dockerfile"
if ($dockerFiles.Count -gt 0) {
    Copy-Item $dockerFiles[0].FullName "backend\Dockerfile" -Force
    if ($dockerFiles.Count -gt 1) {
        Copy-Item $dockerFiles[1].FullName "frontend\Dockerfile" -Force
    }
}

Write-Host "[OK] Backend files moved" -ForegroundColor Green
Write-Host ""

# Move frontend files
Write-Host "Moving frontend files..." -ForegroundColor Yellow

# UI Components
if (Test-Path "Button.tsx") { Move-Item "Button.tsx" "frontend\src\components\ui\" -Force }
if (Test-Path "Card.tsx") { Move-Item "Card.tsx" "frontend\src\components\ui\" -Force }
if (Test-Path "Input.tsx") { Move-Item "Input.tsx" "frontend\src\components\ui\" -Force }
if (Test-Path "Table.tsx") { Move-Item "Table.tsx" "frontend\src\components\ui\" -Force }

# Pages
if (Test-Path "Dashboard.tsx") { Move-Item "Dashboard.tsx" "frontend\src\pages\" -Force }
if (Test-Path "Login.tsx") { Move-Item "Login.tsx" "frontend\src\pages\" -Force }

# Theme
if (Test-Path "index.ts") { Move-Item "index.ts" "frontend\src\theme\" -Force }

# Root src files
if (Test-Path "App.tsx") { Move-Item "App.tsx" "frontend\src\" -Force }
if (Test-Path "main.tsx") { Move-Item "main.tsx" "frontend\src\" -Force }
if (Test-Path "index.css") { Move-Item "index.css" "frontend\src\" -Force }

# Frontend root files
if (Test-Path "package.json") { Move-Item "package.json" "frontend\" -Force }
if (Test-Path "tsconfig.json") { Move-Item "tsconfig.json" "frontend\" -Force }
if (Test-Path "vite.config.ts") { Move-Item "vite.config.ts" "frontend\" -Force }
if (Test-Path "tailwind.config.js") { Move-Item "tailwind.config.js" "frontend\" -Force }
if (Test-Path "postcss.config.js") { Move-Item "postcss.config.js" "frontend\" -Force }
if (Test-Path "index.html") { Move-Item "index.html" "frontend\" -Force }

Write-Host "[OK] Frontend files moved" -ForegroundColor Green
Write-Host ""

# Create missing .env.example files if needed
if (-not (Test-Path "backend\.env.example")) {
    Write-Host "Creating backend\.env.example..." -ForegroundColor Yellow
    @"
# Application
APP_NAME=Precision Receipt
NODE_ENV=development
PORT=8000
DEBUG=true

# Database
DATABASE_URL=postgresql://precision:precision123@postgres:5432/precision_receipt

# Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
ENCRYPTION_KEY=your-encryption-key-must-be-32-bytes-long-exactly!!
SESSION_SECRET=your-session-secret-key-change-in-production

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Features
WHATSAPP_ENABLED=true
SMS_ENABLED=true
EMAIL_ENABLED=true
"@ | Out-File -FilePath "backend\.env.example" -Encoding UTF8
    Write-Host "[OK] Created backend\.env.example" -ForegroundColor Green
}

if (-not (Test-Path "frontend\.env.example")) {
    Write-Host "Creating frontend\.env.example..." -ForegroundColor Yellow
    @"
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=Precision Receipt
"@ | Out-File -FilePath "frontend\.env.example" -Encoding UTF8
    Write-Host "[OK] Created frontend\.env.example" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Organization Complete! ✅" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Directory structure:" -ForegroundColor White
Write-Host ""
Get-ChildItem -Directory | ForEach-Object { Write-Host "  📁 $_" -ForegroundColor Cyan }
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: " -NoNewline -ForegroundColor Gray
Write-Host ".\setup-windows.bat" -ForegroundColor White
Write-Host "  2. Or run: " -NoNewline -ForegroundColor Gray
Write-Host "docker-compose up -d" -ForegroundColor White
Write-Host ""

# Check if docker-compose.yml exists
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "[WARNING] docker-compose.yml not found!" -ForegroundColor Yellow
    Write-Host "You need to download it from the chat." -ForegroundColor Yellow
    Write-Host ""
}

Read-Host "Press Enter to continue"
