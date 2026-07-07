@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo Starting The Study Architect at http://localhost:3000
echo Using webpack with extra memory (stable dev mode).
npm run dev:stable
