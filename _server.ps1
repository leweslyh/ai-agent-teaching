# ============================================================
#  _本地服务.ps1 —— AI智能体互动学习实验室 · 本地静态服务器
#
#  由「启动.bat」调用，请勿单独删除。
#  零依赖：只使用 Windows 自带的 PowerShell，不必安装 Python / Node。
#
#  作用：把本目录发布到 http://localhost:<端口>。
#        浏览器的安全模型把 localhost 视为“可信来源”，
#        语音识别（麦克风）、云端语音/图片识别才能正常工作；
#        直接双击 index.html（file://）会因来源为 null 而被拒绝。
#
#  参数：
#    -Port <n>      指定端口（0 = 自动从 8124 起探测空闲端口）
#    -NoBrowser     启动后不自动打开浏览器（后台/自动化/截图时使用）
# ============================================================

param(
  [int]$Port = 0,
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root     = $PSScriptRoot
$BasePort = 8124
$MaxPort  = 8134
$AppTitle = 'AI智能体互动学习实验室'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '   AI智能体互动学习实验室 · 一键启动' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

# ---------- 0. 检查目录 ----------
if (-not (Test-Path -LiteralPath (Join-Path $Root 'index.html'))) {
  Write-Host '  [错误] 未找到 index.html。' -ForegroundColor Red
  Write-Host '  请把本程序放在项目根目录（与 index.html 同一层）。'
  exit 1
}

# ---------- 1. 探测：本系统服务是否已在运行 / 哪个端口空闲 ----------
Write-Host '  正在检查本地服务状态……'

function Test-OurServer($port) {
  try {
    $resp = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/index.html" -f $port) -UseBasicParsing -TimeoutSec 1
    return ($resp.Content -like ("*" + $AppTitle + "*"))
  } catch {
    return $false
  }
}

function Test-PortBusy($port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect('127.0.0.1', $port)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

$runningPort = 0
$freePort    = 0

if ($Port -gt 0) {
  # 指定端口（供 _start_bg.ps1 后台启动器调用）：只检查该端口
  if (Test-OurServer $Port)      { $runningPort = $Port }
  elseif (-not (Test-PortBusy $Port)) { $freePort = $Port }
} else {
  for ($p = $BasePort; $p -le $MaxPort; $p++) {
    if (Test-OurServer $p) { $runningPort = $p; break }
  }
  if ($runningPort -eq 0) {
    for ($p = $BasePort; $p -le $MaxPort; $p++) {
      if (-not (Test-PortBusy $p)) { $freePort = $p; break }
    }
  }
}

# 已在运行：不重复启动，直接开浏览器
if ($runningPort -gt 0) {
  Write-Host ("  [提示] 本系统已在运行（端口 {0}）。" -f $runningPort) -ForegroundColor Green
  if (-not $NoBrowser) {
    Write-Host '  正在打开浏览器……'
    Start-Process ("http://localhost:{0}/index.html" -f $runningPort)
  }
  Start-Sleep -Milliseconds 300
  exit 0
}

if ($freePort -eq 0) {
  Write-Host ("  [错误] 端口 {0}~{1} 都被占用，请关闭其他程序后重试。" -f $BasePort, $MaxPort) -ForegroundColor Red
  exit 1
}

$port = $freePort
$url  = "http://localhost:{0}/index.html" -f $port

# ---------- 2. 启动内置服务器 ----------
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add(("http://localhost:{0}/" -f $port))
$listener.Prefixes.Add(("http://127.0.0.1:{0}/" -f $port))

try {
  $listener.Start()
} catch {
  Write-Host ("  [错误] 无法监听端口 {0}：{1}" -f $port, $_.Exception.Message) -ForegroundColor Red
  exit 1
}

Write-Host ("  [成功] 本地服务已启动（端口 {0}）。" -f $port) -ForegroundColor Green
Write-Host ''
Write-Host ("  访问地址：{0}" -f $url) -ForegroundColor Yellow
Write-Host '  关闭本窗口即可停止服务。' -ForegroundColor DarkGray
Write-Host ''

# 写入运行标记文件（供 _start_bg.ps1 / _stop.ps1 复用与停止；后台模式下不阻塞调用方）
$runtimeFile = Join-Path $Root '_runtime.json'
try {
  @{ port = $port; url = $url; pid = $PID; startedAt = (Get-Date).ToString('s') } |
    ConvertTo-Json -Compress | Set-Content -LiteralPath $runtimeFile -Encoding UTF8
} catch { }

# ---------- 3. 打开默认浏览器（仅前台模式；后台模式加 -NoBrowser 跳过） ----------
if (-not $NoBrowser) { Start-Process $url }

# ---------- 4. 静态文件服务循环 ----------
$rootFull    = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
$rootWithSep = $rootFull + '\'

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.mjs'  = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.map'  = 'application/json; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ttf'  = 'font/ttf'
}

try {
while ($listener.IsListening) {

  $ctx = $listener.GetContext()

  try {
    # 解析并做路径穿越防护
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }

    $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))

    if (-not $full.StartsWith($rootWithSep, [System.StringComparison]::OrdinalIgnoreCase)) {
      $ctx.Response.StatusCode = 403
      $body = [System.Text.Encoding]::UTF8.GetBytes('403 Forbidden')
      $ctx.Response.ContentType = 'text/plain; charset=utf-8'
      $ctx.Response.OutputStream.Write($body, 0, $body.Length)
    }
    elseif (Test-Path -LiteralPath $full -PathType Container) {
      # 目录 → 返回其 index.html
      $indexFile = Join-Path $full 'index.html'
      if (Test-Path -LiteralPath $indexFile -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($indexFile)
        $ctx.Response.ContentType = 'text/html; charset=utf-8'
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ctx.Response.StatusCode = 404
        $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
        $ctx.Response.ContentType = 'text/plain; charset=utf-8'
        $ctx.Response.OutputStream.Write($body, 0, $body.Length)
      }
    }
    elseif (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      if ($mime.ContainsKey($ext)) {
        $ctx.Response.ContentType = $mime[$ext]
      } else {
        $ctx.Response.ContentType = 'application/octet-stream'
      }
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    else {
      $ctx.Response.StatusCode = 404
      $body = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
      $ctx.Response.ContentType = 'text/plain; charset=utf-8'
      $ctx.Response.OutputStream.Write($body, 0, $body.Length)
    }
  } catch {
    try { $ctx.Response.StatusCode = 500 } catch { }
  } finally {
    try { $ctx.Response.OutputStream.Close() } catch { }
  }
}
} finally {
  try { $listener.Stop() } catch { }
  try { $listener.Close() } catch { }
  try { Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue } catch { }
}