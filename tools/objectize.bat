@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

rem ============================================================================
rem  objectize.bat — перетащи PNG-рендер на этот файл.
rem  Спросит, какой это объект, и положит .symbol.svg рядом с исходником.
rem ============================================================================

if "%~1"=="" (
  echo.
  echo   Перетащи PNG-рендер мышкой на этот файл.
  echo.
  pause
  exit /b
)

where python >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Python не найден. Поставь с python.org, при установке
  echo   обязательно отметь "Add python.exe to PATH".
  echo.
  pause
  exit /b
)

python -c "import numpy, PIL, vtracer" 2>nul
if errorlevel 1 (
  echo   Ставлю зависимости, это один раз...
  python -m pip install --quiet numpy pillow vtracer
)

echo.
echo   Какой это объект?
echo.
echo     1  контейнер          7  вагон крытый
echo     2  бетонный блок      8  вагон-платформа
echo     3  бытовка            9  вагон-цистерна
echo     4  легковая          10  наливняк
echo     5  фургон            11  резервуар
echo     6  автобус           12  кран
echo.
set /p N=  Номер:

set ID=
if "%N%"=="1"  set ID=obj-container
if "%N%"=="2"  set ID=obj-block
if "%N%"=="3"  set ID=obj-cabin
if "%N%"=="4"  set ID=obj-car
if "%N%"=="5"  set ID=obj-van
if "%N%"=="6"  set ID=obj-bus
if "%N%"=="7"  set ID=obj-wagon-box
if "%N%"=="8"  set ID=obj-wagon-flat
if "%N%"=="9"  set ID=obj-wagon-tank
if "%N%"=="10" set ID=obj-tanker
if "%N%"=="11" set ID=obj-tank
if "%N%"=="12" set ID=obj-crane

if "!ID!"=="" (
  echo   Не понял номер.
  pause
  exit /b
)

echo.
python "%~dp0objectize.py" "%~1" --id !ID! --out "%~dp1"
echo.
pause
