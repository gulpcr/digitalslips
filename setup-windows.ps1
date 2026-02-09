# Precision Receipt - Windows PowerShell Setup Script
# Run this script to quickly set up the application

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Precision Receipt - Windows Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check command exists
function Test-Command {
    param($Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# Step 1: Check Docker
Write-Host "[1/5] Checking Docker installation..." -ForegroundColor Yellow
if (-not (Test-Command docker)) {
    Write-Host "[ERROR] Docker is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Red
    Write-Host "Then run this script again." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Docker is running
try {
    docker ps | Out-Null
    Write-Host "[OK] Docker is running" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 2: Check Docker Compose
Write-Host "[2/5] Checking Docker Compose..." -ForegroundColor Yellow
try {
    docker compose version | Out-Null
    Write-Host "[OK] Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker Compose is not available!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Step 3: Configure environment files
Write-Host "[3/5] Setting up environment files..." -ForegroundColor Yellow

if (-not (Test-Path "backend\.env")) {
    Write-Host "Creating backend\.env..." -ForegroundColor Gray
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "[OK] Created backend\.env" -ForegroundColor Green
} else {
    Write-Host "[SKIP] backend\.env already exists" -ForegroundColor Gray
}

if (-not (Test-Path "frontend\.env")) {
    Write-Host "Creating frontend\.env..." -ForegroundColor Gray
    Copy-Item "frontend\.env.example" "frontend\.env"
    Write-Host "[OK] Created frontend\.env" -ForegroundColor Green
} else {
    Write-Host "[SKIP] frontend\.env already exists" -ForegroundColor Gray
}
Write-Host ""

# Step 4: Start Docker services
Write-Host "[4/5] Starting Docker services..." -ForegroundColor Yellow
Write-Host "This may take a few minutes on first run..." -ForegroundColor Gray

try {
    docker-compose up -d
    Write-Host "[OK] Services started" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to start services!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host ""

# Wait for services
Write-Host "Waiting for services to be ready (30 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30
Write-Host ""

# Step 5: Seed database
Write-Host "[5/5] Seeding the database..." -ForegroundColor Yellow
try {
    docker-compose exec backend python app/database/seed.py
    Write-Host "[OK] Database seeded successfully" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Database seeding may have failed" -ForegroundColor Yellow
    Write-Host "You can try again manually with:" -ForegroundColor Gray
    Write-Host "  docker-compose exec backend python app/database/seed.py" -ForegroundColor Gray
}
Write-Host ""

# Success message
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete! 🎉" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your application is now running:" -ForegroundColor White
Write-Host ""
Write-Host "  Frontend:  " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend:   " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:8000" -ForegroundColor Cyan
Write-Host "  API Docs:  " -NoNewline -ForegroundColor Gray
Write-Host "http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default Login:" -ForegroundColor Yellow
Write-Host "  Username: admin" -ForegroundColor White
Write-Host "  Password: Admin@123456" -ForegroundColor White
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Yellow
Write-Host "  View logs:      " -NoNewline -ForegroundColor Gray
Write-Host "docker-compose logs -f" -ForegroundColor White
Write-Host "  Stop services:  " -NoNewline -ForegroundColor Gray
Write-Host "docker-compose down" -ForegroundColor White
Write-Host "  Restart:        " -NoNewline -ForegroundColor Gray
Write-Host "docker-compose restart" -ForegroundColor White
Write-Host ""

# Open browser
Write-Host "Opening browser in 5 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"

Write-Host ""
Read-Host "Press Enter to exit"
