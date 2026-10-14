param([string]$Query = "", [string]$Out = "pg.png", [int]$W = 1240, [int]$H = 1000, [int]$Budget = 4000)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$page = Join-Path $root '_verify.html'
$uri = ([System.Uri]$page).AbsoluteUri + $Query
$outPath = Join-Path $root ('_preview\' + $Out)
New-Item -ItemType Directory -Force -Path (Join-Path $root '_preview') | Out-Null
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
& $chrome --headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=$Budget --window-size=$W,$H --screenshot=$outPath $uri | Out-Null
if (Test-Path $outPath) { Write-Output ("OK " + (Get-Item $outPath).Length + " bytes -> " + $outPath) } else { Write-Output "FAILED" }
