@echo off
cd /d "C:\Users\johnn\Desktop\NousAI-App"
echo Starting Physics Extractor...
node scripts/extract-physics.mjs > scripts/output/extract-log.txt 2>&1
echo Done. Exit code: %errorlevel%
