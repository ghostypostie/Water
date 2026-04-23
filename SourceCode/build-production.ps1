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
# Close any running electron processes first
Write-Host "Closing any running Water Client instances..." -ForegroundColor Yellow
Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process Water -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

# Try multiple times to remove node_modules
$retries = 0
$maxRetries = 3
while ($retries -lt $maxRetries) {
    try {
        Remove-Item -Recurse -Force node_modules -ErrorAction Stop
        break
    } catch {
        $retries++
        if ($retries -lt $maxRetries) {
            Write-Host "Retry $retries/$maxRetries - waiting for file locks to release..." -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        } else {
            Write-Host "WARNING: Could not fully clean node_modules, continuing anyway..." -ForegroundColor Yellow
        }
    }
}
Write-Host "node_modules cleaned ✓" -ForegroundColor Green
Write-Host ""

# Step 4: Install production dependencies only
Write-Host "[4/7] Installing production dependencies..." -ForegroundColor Cyan
npm install --omit=dev --force
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install production dependencies!" -ForegroundColor Red
    # Restore and exit
    if (Test-Path package.json.backup) {
        Copy-Item package.json.backup package.json -Force
        Remove-Item package.json.backup -Force
    }
    npm install
    exit 1
}
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

# Check for Water.exe (new naming convention)
if (Test-Path "dist/Water.exe") {
    $installer = Get-Item "dist/Water.exe"
    $sizeMB = [math]::Round($installer.Length / 1MB, 2)
    Write-Host "Installer: $($installer.Name)" -ForegroundColor Cyan
    Write-Host "Location: $($installer.FullName)" -ForegroundColor White
    Write-Host "Size: $sizeMB MB" -ForegroundColor Yellow
    Write-Host ""
    
    # Check for latest.yml (required for auto-updates)
    if (Test-Path "dist/latest.yml") {
        Write-Host "✓ Update metadata (latest.yml) generated" -ForegroundColor Green
    } else {
        Write-Host "⚠ WARNING: latest.yml not found - auto-updates may not work!" -ForegroundColor Yellow
    }
    
    if ($sizeMB -lt 80) {
        Write-Host "✓ Size optimized! (down from 110MB)" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "=== Ready for GitHub Release ===" -ForegroundColor Cyan
    Write-Host "Upload these files to GitHub release:" -ForegroundColor White
    Write-Host "  1. Water.exe" -ForegroundColor Yellow
    Write-Host "  2. latest.yml" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Release tag format: v" -NoNewline -ForegroundColor White
    $version = (Get-Content package.json | ConvertFrom-Json).version
    Write-Host $version -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "WARNING: Installer not found in dist/" -ForegroundColor Yellow
    Write-Host "Expected: dist/Water.exe" -ForegroundColor Yellow
}
Write-Host ""
