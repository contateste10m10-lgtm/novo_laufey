@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale Node.js 18 ou superior e tente novamente.
  pause
  exit /b 1
)
echo === SampEn validation battery ===
node --test tests/battery.test.cjs
if errorlevel 1 (
  echo.
  echo FALHA: pelo menos um teste nao passou. Nao integre as alteracoes no site ainda.
  pause
  exit /b 1
)
echo.
echo === Benchmark analitico uniforme-iid ===
node scripts/run-uniform-benchmark.cjs
if errorlevel 1 (
  echo.
  echo FALHA no benchmark analitico.
  pause
  exit /b 1
)
echo.
echo Todos os testes desta bateria passaram.
pause
