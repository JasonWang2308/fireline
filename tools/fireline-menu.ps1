# 火線交鋒 FIRELINE — 更新 / 推送 / 啟動工具
# 由桌面的「火線交鋒 更新.bat」呼叫。這個檔案放在 repo 裡，git pull 時會跟著更新。
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

function Write-LanUrls([int]$Port) {
  $ips = Get-LanIPs
  if (-not $ips) { Write-Host '找不到這台電腦的區網位址，請確認已連上 Wi-Fi 或網路線。' -ForegroundColor Yellow; return }
  Write-Host '給同一個 Wi-Fi 朋友的網址：' -ForegroundColor Green
  foreach ($ip in $ips) { Write-Host "    http://${ip}:$Port" -ForegroundColor Green }
  try { Set-Clipboard -Value ("http://" + $ips[0] + ":$Port"); Write-Host '（第一個網址已複製到剪貼簿，可以直接貼給朋友）' } catch {}
}

function Show-FriendUrl {
  Write-Host ''
  $port = $null
  foreach ($p in 3000, 3001) { $o = Get-PortOwner $p; if ($o -and $o.ProcessName -eq 'node') { $port = $p; break } }
  if (-not $port) {
    Write-Host '遊戲伺服器目前沒有在執行。' -ForegroundColor Yellow
    Write-Host '請先在另一個視窗選 1 或 3 啟動遊戲，朋友才連得進來。下面先列出啟動後的網址：'
    $port = 3000
  }
  Write-LanUrls $port
  Write-Host ''
  Write-Host '朋友連不進來的話：' -ForegroundColor Cyan
  Write-Host '  - 確認對方跟你連的是同一個 Wi-Fi（訪客網路通常互相連不到）'
  Write-Host '  - 第一次啟動時 Windows 防火牆若有跳窗，要勾「私人網路」並允許 Node.js'
  Write-Host '  - 連線後選「線上對戰」，你建立房間，再把 4 個字的房間代碼傳給朋友'
  Wait-Menu
}

function Start-Game {
  $port = 3000
  $owner = Get-PortOwner $port
  if ($owner) {
    if ($owner.ProcessName -eq 'node') {
      Write-Host "連接埠 $port 已經有遊戲伺服器在執行，可能是更新前的舊版本。" -ForegroundColor Yellow
      $a = Read-Host '要關閉它並用最新版重新啟動嗎？(Y/N，直接按 Enter = Y)'
      if ($a -eq '' -or $a -match '^[Yy]') {
        Stop-Process -Id $owner.Id -Force
        Start-Sleep -Milliseconds 800
      } else {
        Start-Process "http://localhost:$port"
        Write-Host '已用瀏覽器打開正在執行的遊戲。'
        Wait-Menu; return
      }
    } else {
      Write-Host "連接埠 3000 被 $($owner.ProcessName) 占用，改用 3001。" -ForegroundColor Yellow
      $port = 3001
    }
  }
  Write-Host ''
  Write-Host "正在啟動遊戲伺服器，瀏覽器會自動打開 http://localhost:$port" -ForegroundColor Cyan
  Write-Host '要停止伺服器請按 Q 或 Ctrl+C，會回到選單。' -ForegroundColor Yellow
  Write-Host ''
  Write-LanUrls $port
  Write-Host ''
  Start-Process cmd -ArgumentList '/c', "timeout /t 2 /nobreak >nul & start http://localhost:$port" -WindowStyle Hidden
  $env:PORT = "$port"
  # Run node directly (not npm.cmd): npm.cmd is itself a batch file, and Ctrl+C inside nested
  # batch files makes cmd ask "Terminate batch job (Y/N)?" once per level.
  $node = Start-Process node -ArgumentList 'server/index.js' -WorkingDirectory $GameDir -NoNewWindow -PassThru
  Remove-Item Env:PORT -ErrorAction SilentlyContinue
  # Catch Ctrl+C ourselves so it only stops the server and never reaches cmd.
  [Console]::TreatControlCAsInput = $true
  try {
    while (-not $node.HasExited) {
      if ([Console]::KeyAvailable) {
        $k = [Console]::ReadKey($true)
        if ($k.Key -eq 'Q' -or ($k.Key -eq 'C' -and ($k.Modifiers -band [ConsoleModifiers]::Control))) { break }
      }
      Start-Sleep -Milliseconds 150
    }
  } finally {
    [Console]::TreatControlCAsInput = $false
    if (-not $node.HasExited) { Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue }
  }
  Write-Host ''
  Write-Host '遊戲伺服器已停止。' -ForegroundColor Cyan
  Wait-Menu
}

function Update-Game {
  Write-Host ''
  Write-Host '[1/2] 從 GitHub 下載最新版…' -ForegroundColor Cyan
  & git pull --ff-only
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host '[注意] 無法自動更新。通常是這台電腦有還沒推送的修改，' -ForegroundColor Yellow
    Write-Host '       可以先選 2 推送，再選 1 更新。' -ForegroundColor Yellow
    Wait-Menu; return
  }
  Write-Host '[2/2] 檢查套件…' -ForegroundColor Cyan
  & npm.cmd install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[錯誤] 套件安裝失敗，請檢查網路後再試一次。' -ForegroundColor Red
    Wait-Menu; return
  }
  Start-Game
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
  Write-Host '=========================================='
  Write-Host '   火線交鋒 FIRELINE' -ForegroundColor Yellow
  Write-Host "   遊戲資料夾：$GameDir"
  Write-Host '=========================================='
  Write-Host ''
  Write-Host '  1. 更新到最新版並啟動遊戲'
  Write-Host '  2. 推送這台電腦的修改到 GitHub'
  Write-Host '  3. 只啟動遊戲（不更新）'
  Write-Host '  4. 顯示給同一個 Wi-Fi 朋友的網址'
  Write-Host '  5. 離開'
  Write-Host ''
  switch (Read-Host '請輸入 1-5 後按 Enter') {
    '1' { Update-Game }
    '2' { Push-Changes }
    '3' { Start-Game }
    '4' { Show-FriendUrl }
    '5' { exit }
  }
}
