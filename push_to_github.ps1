Set-Location -Path $PSScriptRoot
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " Pushing code to GitHub: huychanpisey/nssf-progress-report" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
& "$PSScriptRoot\tools\git\cmd\git.exe" push -u origin main
Write-Host "Process completed!" -ForegroundColor Green
Read-Host "Press Enter to exit"
