# Build script for Android - static export without API routes

Write-Host "Building for Android..." -ForegroundColor Cyan

# Backup API folder
Write-Host "Temporarily moving API folder..." -ForegroundColor Yellow
Move-Item -Path "src\app\api" -Destination "api-backup" -Force -ErrorAction SilentlyContinue

# Also remove .next cache to avoid validator errors
Write-Host "Cleaning .next cache..." -ForegroundColor Yellow
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue

# Backup production config
Write-Host "Backing up production config..." -ForegroundColor Yellow
Copy-Item -Path "next.config.ts" -Destination "next.config.prod.backup" -Force

# Use Android-specific config
Write-Host "Using Android Next.js config..." -ForegroundColor Yellow
Copy-Item -Path "next.config.android.ts" -Destination "next.config.ts" -Force

# Build
Write-Host "Running Next.js build..." -ForegroundColor Green
npm run build

# Sync to Capacitor
Write-Host "Syncing to Android..." -ForegroundColor Green
npx cap sync android

# Restore API folder
Write-Host "Restoring API folder..." -ForegroundColor Yellow
Move-Item -Path "api-backup" -Destination "src\app\api" -Force -ErrorAction SilentlyContinue

# Restore production config
Write-Host "Restoring production config..." -ForegroundColor Yellow
Move-Item -Path "next.config.prod.backup" -Destination "next.config.ts" -Force

Write-Host "Android build complete!" -ForegroundColor Green
Write-Host "Run 'npx cap open android' to open in Android Studio" -ForegroundColor Cyan
