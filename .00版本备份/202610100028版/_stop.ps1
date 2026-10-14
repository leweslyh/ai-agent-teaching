# ============================================================
#  _stop.ps1 —— 停止由 _start_bg.ps1 启动的后台本地服务
#
#  用法：
#    powershell -NoProfile -ExecutionPolicy Bypass -File _stop.ps1
# ============================================================

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$runtime = Join-Path $PSScriptRoot '_runtime.json'
$stopped = $false

if (Test-Path -LiteralPath $runtime) {
  try {
    $info = Get-Content -LiteralPath $runtime -Raw | ConvertFrom-Json
    if ($info.pid) {
      Stop-Process -Id $info.pid -Force -ErrorAction SilentlyContinue
      $stopped = $true
    }
  } catch { }
  Remove-Item -LiteralPath $runtime -Force -ErrorAction SilentlyContinue
}

if ($stopped) { Write-Host '已停止后台本地服务。' }
else { Write-Host '没有正在运行的后台本地服务（或它已被关闭）。' }
