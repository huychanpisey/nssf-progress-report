@echo off
cd /d "%~dp0"
echo ======================================================================
echo   Pushing code to GitHub: huychanpisey/nssf-progress-report
echo ======================================================================
echo.
echo Please authorize in the browser popup if prompted...
echo.
"%~dp0tools\git\cmd\git.exe" push -u origin main
echo.
echo ======================================================================
echo   Process completed!
echo ======================================================================
pause
