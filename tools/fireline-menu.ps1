# 火線交鋒 FIRELINE — 更新 / 推送 / 啟動工具
# 由「火線交鋒 更新.bat」呼叫。這個檔案放在 repo 裡，git pull 時會跟著更新。
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$GameDir = Split-Path -Parent $PSScriptRoot
Set-Location $GameDir
$Host.UI.RawUI.WindowTitle = '火線交鋒 FIRELINE 工具'

function Wait-Menu { Write-Host ''; Read-Host '按 Enter 回到選單' | Out-Null }

function Get-PortOwner([int]$Port) {
  try {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($c) { return Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue }
  } catch {}
  return $null
}

# 這台電腦在區網裡的 IPv4 位址（只取有預設閘道、已連線的網卡，避開 VirtualBox / Docker 之類的虛擬網卡）
function Get-LanIPs {
  $ips = @()
  try {
    $ips = Get-NetIPConfiguration -ErrorAction Stop |
      Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
      ForEach-Object { $_.IPv4Address.IPAddress }
  } catch {}
  if (-not $ips) {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|Loopback' } |
      ForEach-Object { $_.IPAddress }
  }
  return @($ips | Select-Object -Unique)
}

function Get-GamePort {
  foreach ($p in 3000, 3001) { $o = Get-PortOwner $p; if ($o -and $o.ProcessName -eq 'node') { return $p } }
  return $null
}

# 伺服器在背景執行（沒有視窗），輸出寫到 logs\server.log，選單可以繼續操作
function Start-ServerBackground([int]$Port) {
  $logDir = Join-Path $GameDir 'logs'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $out = Join-Path $logDir 'server.log'; $err = Join-Path $logDir 'server-error.log'
  $env:PORT = "$Port"
  $p = Start-Process node -ArgumentList 'server/index.js' -WorkingDirectory $GameDir -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
  Remove-Item Env:PORT -ErrorAction SilentlyContinue
  for ($i = 0; $i -lt 25; $i++) {
    Start-Sleep -Milliseconds 200
    if (Get-PortOwner $Port) { return $true }
    if ($p.HasExited) { break }
  }
  Write-Host '[錯誤] 遊戲伺服器沒有成功啟動，錯誤訊息：' -ForegroundColor Red
  if (Test-Path $err) { Get-Content $err -Tail 15 | ForEach-Object { Write-Host "  $_" } }
  return $false
}

function Stop-GameServer {
  foreach ($p in 3000, 3001) { $o = Get-PortOwner $p; if ($o -and $o.ProcessName -eq 'node') { Stop-Process -Id $o.Id -Force -ErrorAction SilentlyContinue } }
  Start-Sleep -Milliseconds 600
}

# 開啟遊戲：伺服器在背景執行，打開瀏覽器，然後直接回到選單（選單上方會顯示朋友網址）
function Start-Game {
  $port = Get-GamePort
  if (-not $port) {
    $port = 3000
    $owner = Get-PortOwner $port
    if ($owner) { Write-Host "連接埠 3000 被 $($owner.ProcessName) 占用，改用 3001。" -ForegroundColor Yellow; $port = 3001 }
    Write-Host ''
    Write-Host '正在背景啟動遊戲伺服器…' -ForegroundColor Cyan
    if (-not (Start-ServerBackground $port)) { Wait-Menu; return }
  }
  Start-Process "http://localhost:$port"
  $ips = Get-LanIPs
  if ($ips) { try { Set-Clipboard -Value ("http://" + $ips[0] + ":$port") } catch {} }
}

function Update-Game {
  Write-Host ''
  $menuFile = Join-Path $GameDir 'tools\fireline-menu.ps1'
  $before = (Get-FileHash $menuFile).Hash
  Write-Host '[1/2] 從 GitHub 下載最新版…' -ForegroundColor Cyan
  & git pull --ff-only
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '[注意] 無法自動更新。通常是這台電腦有還沒推送的修改，' -ForegroundColor Yellow
    Write-Host '       可以先選 1 推送，再選 2 更新。' -ForegroundColor Yellow
    Wait-Menu; return
  }
  Write-Host '[2/2] 檢查套件…' -ForegroundColor Cyan
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[錯誤] 套件安裝失敗，請檢查網路後再試一次。' -ForegroundColor Red
    Wait-Menu; return
  }
  Write-Host ''
  Write-Host '更新完成！' -ForegroundColor Green
  $port = Get-GamePort
  if ($port) {
    # 正在跑的伺服器還是舊版，換成新版
    Stop-GameServer
    if (Start-ServerBackground $port) { Write-Host '背景的遊戲伺服器已換成新版，瀏覽器重新整理（F5）就是最新版。' -ForegroundColor Green }
  } else {
    Write-Host '選 3 開啟遊戲。'
  }
  if ((Get-FileHash $menuFile).Hash -ne $before) {
    Write-Host ''
    Write-Host '這次更新也改了選單本身，請關閉這個視窗再重新打開，新選單才會生效。' -ForegroundColor Yellow
  }
  Wait-Menu
}

function Push-Changes {
  Write-Host ''
  $changes = & git status --short
  if (-not $changes) { Write-Host '目前沒有需要推送的修改。'; Wait-Menu; return }
  Write-Host '以下檔案有修改：'
  $changes | ForEach-Object { Write-Host "  $_" }
  Write-Host ''
  $msg = Read-Host '請輸入這次修改的說明（直接按 Enter 使用預設）'
  if (-not $msg) { $msg = '更新 ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
  & git add -A
  & git commit -m $msg
  if ($LASTEXITCODE -ne 0) { Write-Host '[錯誤] 建立提交失敗。' -ForegroundColor Red; Wait-Menu; return }
  Write-Host '與 GitHub 上的最新版本同步…' -ForegroundColor Cyan
  & git pull --rebase
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[錯誤] 你的修改和 GitHub 上的新版本衝突，請先處理衝突再推送。' -ForegroundColor Red
    Wait-Menu; return
  }
  & git push
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[錯誤] 推送失敗。第一次推送會跳出 GitHub 登入視窗，請登入後再試一次。' -ForegroundColor Red
    Wait-Menu; return
  }
  Write-Host ''
  Write-Host '推送完成！' -ForegroundColor Green
  Wait-Menu
}

while ($true) {
  Clear-Host
  $port = Get-GamePort
  Write-Host '=========================================='
  Write-Host '   火線交鋒 FIRELINE' -ForegroundColor Yellow
  Write-Host "   遊戲資料夾：$GameDir"
  if ($port) {
    Write-Host "   伺服器：背景執行中 http://localhost:$port" -ForegroundColor Green
    $ips = Get-LanIPs
    if ($ips) {
      Write-Host '   給朋友的網址（同一台路由器，Wi-Fi 或網路線都可以）：' -ForegroundColor Green
      foreach ($ip in $ips) { Write-Host "     http://${ip}:$port" -ForegroundColor Green }
      Write-Host '   第一個網址已複製到剪貼簿，直接貼給朋友即可'
    } else { Write-Host '   找不到這台電腦的區網位址，請確認已連上網路。' -ForegroundColor Yellow }
  } else { Write-Host '   伺服器：未啟動' -ForegroundColor DarkGray }
  Write-Host '=========================================='
  Write-Host ''
  Write-Host '  1. 推送這台電腦的修改到 GitHub'
  Write-Host '  2. 從 GitHub 更新到最新版'
  if ($port) { Write-Host '  3. 開啟遊戲（伺服器已在執行，再打開一次瀏覽器）' } else { Write-Host '  3. 開啟遊戲' }
  Write-Host '  4. 離開（會關閉遊戲伺服器）'
  Write-Host ''
  switch (Read-Host '請輸入 1-4 後按 Enter') {
    '1' { Push-Changes }
    '2' { Update-Game }
    '3' { Start-Game }
    '4' { if (Get-GamePort) { Write-Host '正在關閉遊戲伺服器…'; Stop-GameServer }; exit }
  }
}
