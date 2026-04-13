# Production Build Script for Water Client
# Creates optimized NSIS installer for distribution

Write-Host "=== Water Client - Production Build ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Compile TypeScript
Write-Host "[1/7] Compiling TypeScript..." -ForegroundColor Cyan
npm run transpile
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: TypeScript compilation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "TypeScript compiled successfully ✓" -ForegroundColor Green
Write-Host ""

# Step 2: Backup package.json
Write-Host "[2/7] Backing up package.json..." -ForegroundColor Cyan
Copy-Item package.json package.json.backup -Force
Write-Host "package.json backed up ✓" -ForegroundColor Green
Write-Host ""

# Step 3: Clean node_modules
Write-Host "[3/7] Cleaning node_modules..." -ForegroundColor Cyan
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Write-Host "node_modules cleaned ✓" -ForegroundColor Green
Write-Host ""

# Step 4: Install production dependencies only
Write-Host "[4/7] Installing production dependencies..." -ForegroundColor Cyan
npm install --production --silent
$prodPackages = (Get-ChildItem node_modules -Directory | Measure-Object).Count
Write-Host "Production dependencies installed ($prodPackages packages) ✓" -ForegroundColor Green
Write-Host ""

# Step 5: Temporarily install electron-builder
Write-Host "[5/7] Installing electron-builder..." -ForegroundColor Cyan
npm install electron-builder@26.8.1 --no-save --silent
Write-Host "electron-builder installed ✓" -ForegroundColor Green
Write-Host ""

# Step 6: Build NSIS installer (x64 only)
Write-Host "[6/7] Building NSIS installer (x64)..." -ForegroundColor Cyan
Write-Host "This may take a few minutes..." -ForegroundColor Yellow

# Clean dist folder first
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

# Build with explicit options
npx electron-builder --win nsis --x64 --config electron-builder.json

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    # Restore package.json
    if (Test-Path package.json.backup) {
        Copy-Item package.json.backup package.json -Force
        Remove-Item package.json.backup -Force
    }
    npm install
    exit 1
}
Write-Host "NSIS installer built successfully ✓" -ForegroundColor Green
Write-Host ""

# Step 7: Restore package.json and dependencies
Write-Host "[7/7] Restoring development environment..." -ForegroundColor Cyan
if (Test-Path package.json.backup) {
    Copy-Item package.json.backup package.json -Force
    Remove-Item package.json.backup -Force
}
npm install --silent
Write-Host "Development dependencies restored ✓" -ForegroundColor Green
Write-Host ""

# Show results
Write-Host "=== Production Build Complete ===" -ForegroundColor Green
Write-Host ""
if (Test-Path "dist/Water-Setup-*.exe") {
    $installer = Get-Item "dist/Water-Setup-*.exe" | Select-Object -First 1
    $sizeMB = [math]::Round($installer.Length / 1MB, 2)
    Write-Host "Installer: $($installer.Name)" -ForegroundColor Cyan
    Write-Host "Location: $($installer.FullName)" -ForegroundColor White
    Write-Host "Size: $sizeMB MB" -ForegroundColor Yellow
    Write-Host ""
    if ($sizeMB -lt 80) {
        Write-Host "✓ Size optimized! (down from 110MB)" -ForegroundColor Green
    }
    Write-Host "✓ Ready for distribution!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Installer not found in dist/" -ForegroundColor Yellow
}
Write-Host ""
