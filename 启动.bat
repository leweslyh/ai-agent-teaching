@echo off
chcp 65001 >nul
title AI智能体互动学习实验室 · 一键启动
cd /d "%~dp0"

if not exist "_server.ps1" (
  echo.
  echo   [错误] 缺少文件：_server.ps1
  echo   请把它与本启动器放在同一个文件夹里（即项目根目录）。
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_server.ps1"
if errorlevel 1 pause
