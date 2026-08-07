Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Albion Pet Clinic - Development" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Start frontend dev server
Write-Host "Starting Frontend (port 5173)..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    Set-Location -LiteralPath $using:PWD
    npm run dev
}

# Start backend dev server
Write-Host "Starting Backend (port 5000)..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    Set-Location -LiteralPath "$using:PWD\server"
    npm run dev
}

Write-Host ""
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend:  http://localhost:5000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Red

# Wait for either job to complete
Wait-Job $frontendJob, $backendJob

# Cleanup on exit
Stop-Job $frontendJob -ErrorAction SilentlyContinue
Stop-Job $backendJob -ErrorAction SilentlyContinue
Remove-Job $frontendJob -ErrorAction SilentlyContinue
Remove-Job $backendJob -ErrorAction SilentlyContinue
