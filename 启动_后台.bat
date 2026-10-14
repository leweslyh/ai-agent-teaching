@echo off
chcp 65001 >nul
title AI智能体互动学习实验室 · 后台启动（命令秒回）
cd /d "%~dp0"

echo.
echo   ============================================================
echo      AI智能体互动学习实验室 · 后台启动
echo   ============================================================
echo.
echo   正在后台启动本地服务并等待就绪……
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0_start_bg.ps1" -Open
if errorlevel 1 (
  echo.
  echo   [失败] 服务没能启动，请查看上面的提示。
  pause
  exit /b 1
)

echo.
echo   服务已在后台运行（关闭本窗口不影响）。
echo   需要停止请运行 _stop.ps1，或重启电脑。
echo.
ping -n 4 127.0.0.1 >nul
