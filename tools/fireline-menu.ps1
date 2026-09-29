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
  Write-Host '要結束遊戲時，直接關閉這個視窗即可。'
  Write-Host ''
  Start-Process cmd -ArgumentList '/c', "timeout /t 2 /nobreak >nul & start http://localhost:$port" -WindowStyle Hidden
  $env:PORT = "$port"
  & npm.cmd start
  Remove-Item Env:PORT -ErrorAction SilentlyContinue
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
  Write-Host '  4. 離開'
  Write-Host ''
  switch (Read-Host '請輸入 1-4 後按 Enter') {
    '1' { Update-Game }
    '2' { Push-Changes }
    '3' { Start-Game }
    '4' { exit }
  }
}
