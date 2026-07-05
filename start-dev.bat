@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
set "NODE_OPTIONS=--max-old-space-size=4096"
cd /d "%~dp0"
echo Starting The Study Architect at http://localhost:3000
echo First page load may take a minute while Turbopack compiles.
npm run dev
