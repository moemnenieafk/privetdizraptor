@echo off
chcp 65001 >nul
rem Запускалка диагностики для стороннего пользователя: двойной клик, и всё.
rem Решает три типовые причины, по которым .ps1 не запускается сам:
rem   1) двойной клик по .ps1 открывает его в блокноте, а не выполняет
rem   2) политика запуска скриптов блокирует файл (-ExecutionPolicy Bypass)
rem   3) файл скачан из интернета и помечен как недоверенный (Unblock-File)
title Диагностика доступа к cta.quest

set "PS1=%~dp0diag-ru-access.ps1"
if not exist "%PS1%" (
  echo.
  echo ОШИБКА: рядом с этим файлом нет diag-ru-access.ps1
  echo Положите оба файла в одну папку и запустите снова.
  echo.
  pause
  exit /b 1
)

echo.
echo Запускаю диагностику. Займёт около двух минут, окно не закрывайте.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '%PS1%' -ErrorAction SilentlyContinue; & '%PS1%'"

if errorlevel 1 (
  echo.
  echo Что-то пошло не так. Пришлите скриншот этого окна.
  echo.
  pause
)
