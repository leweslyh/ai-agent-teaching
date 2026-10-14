# ============================================================
#  _start_bg.ps1 —— 后台启动本地服务并等待就绪，然后立即返回
#
#  为什么需要它：
#    _server.ps1 是“常驻服务”（内部是 while 死循环），如果在前台直接运行，
#    命令永远不会返回——在自动化/Agent（如 CodeBuddy）里会表现为“卡住不往下走”。
#    本脚本把服务丢到独立的隐藏进程里跑，自己轮询到“真的能访问”之后马上退出，
#    所以调用方（终端 / Agent / 批处理）都能秒回。
#
#  用法：
#    powershell -NoProfile -ExecutionPolicy Bypass -File _start_bg.ps1 [-Port 8124] [-Open]
#    -Port  指定端口（默认自动从 8124 探测空闲端口）
#    -Open  就绪后顺便用默认浏览器打开（人手动双击时用）
#
#  成功时输出： READY http://localhost:<port>/index.html
# ============================================================

param(
  [int]$Port = 0,
  [switch]$Open
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root     = $PSScriptRoot
$BasePort = if ($Port -gt 0) { $Port } else { 8124 }
$MaxPort  = $BasePort + 10
$runtime  = Join-Path $Root '_runtime.json'
$server   = Join-Path $Root '_server.ps1'

function Test-PortBusy($p) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $p)
    $c.Close()
    return $true
  } catch {
    return $false
  }
}

# ---------- 1. 若已有实例在运行，直接复用 ----------
if (Test-Path -LiteralPath $runtime) {
  try {
    $info = Get-Content -LiteralPath $runtime -Raw | ConvertFrom-Json
    if ($info.port -and (Test-PortBusy $info.port)) {
      Write-Host ("READY {0}" -f $info.url)
      if ($Open) { Start-Process $info.url }
      exit 0
    }
  } catch { }
  Remove-Item -LiteralPath $runtime -Force -ErrorAction SilentlyContinue
}

# ---------- 2. 挑一个空闲端口 ----------
$chosen = 0
for ($p = $BasePort; $p -le $MaxPort; $p++) {
  if (-not (Test-PortBusy $p)) { $chosen = $p; break }
}
if ($chosen -eq 0) {
  Write-Host ("[错误] 端口 {0}~{1} 都被占用，请关闭其他程序后重试。" -f $BasePort, $MaxPort) -ForegroundColor Red
  exit 1
}

# ---------- 3. 用后台隐藏进程启动服务（关键：不占用当前终端） ----------
if (-not (Test-Path -LiteralPath $server)) {
  Write-Host "[错误] 缺少 _server.ps1，请确认它在项目根目录。" -ForegroundColor Red
  exit 1
}
$argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$server`" -Port $chosen -NoBrowser"
Start-Process -FilePath 'powershell' -ArgumentList $argLine -WindowStyle Hidden

# ---------- 4. 轮询直到真正就绪（最多 20 秒），就绪就返回 ----------
$url = "http://localhost:$chosen/index.html"
for ($i = 0; $i -lt 40; $i++) {
  try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 1
    if ($resp.StatusCode -eq 200) {
      Write-Host ("READY {0}" -f $url)
      if ($Open) { Start-Process $url }
      exit 0
    }
  } catch { }
  Start-Sleep -Milliseconds 500
}

Write-Host ("[错误] 服务启动超时（端口 {0}）。" -f $chosen) -ForegroundColor Red
exit 1
