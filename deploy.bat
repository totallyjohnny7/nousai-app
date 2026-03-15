@echo off
cd /d "C:\Users\johnn\Desktop\NousAI-App"
npm run build > build-output.txt 2>&1
if %ERRORLEVEL% neq 0 (
  echo BUILD FAILED >> build-output.txt
  exit /b 1
)
echo BUILD SUCCESS >> build-output.txt
vercel --prod --yes >> build-output.txt 2>&1
echo DEPLOY DONE >> build-output.txt
