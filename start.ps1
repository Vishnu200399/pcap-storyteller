# Start PCAP Storyteller dev servers
Write-Host "`n  PCAP Storyteller" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Backend  → http://localhost:3001" -ForegroundColor Gray
Write-Host "  Frontend → http://localhost:5173`n" -ForegroundColor Gray

$backend  = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\NETWORKING_AI\backend;  node src/index.js" -PassThru
$frontend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd C:\NETWORKING_AI\frontend; npx vite" -PassThru

Write-Host "  Both servers starting in new windows." -ForegroundColor Green
Write-Host "  Open http://localhost:5173 in your browser.`n" -ForegroundColor Green
